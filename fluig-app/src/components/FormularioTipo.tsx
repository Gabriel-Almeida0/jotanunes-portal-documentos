import { useState, type FormEvent, type ReactNode } from 'react';
import { ErroApi, ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Abrangencia, TipoDocumento } from '../api/tipos';
import {
  LIMITES,
  OPCOES_PERIODICIDADE,
  opcaoDe,
  paraPeriodicidade,
  previaPeriodicidade,
  type OpcaoPeriodicidade,
} from '../utils/periodicidade';
import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { Campo, CampoArea, CampoSelecao } from './Campo';
import { Modal } from './Modal';

const OPCOES_ABRANGENCIA: { valor: Abrangencia; rotulo: string; ajuda: string }[] = [
  { valor: 'GERAL', rotulo: 'Geral da empresa', ajuda: 'enviado uma vez, vale em todas as obras' },
  { valor: 'POR_OBRA', rotulo: 'Por obra', ajuda: 'cada obra escolhe se exige' },
];

const LIMITE_INSTRUCOES = 1000;

/** Texto do campo numérico → inteiro dentro da faixa, ou `null`. */
function inteiroNaFaixa(texto: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n >= min && n <= max ? n : null;
}

/** Cadastro/edição de tipo de documento (tela "Tipos de documento" e aba "Documentos exigidos" da obra). */
export function FormularioTipo({
  tipo,
  abrangenciaFixa,
  aviso,
  onFechar,
  onSalvo,
  onSemPermissao,
}: {
  tipo: TipoDocumento | null;
  /** Cria o tipo já com esta abrangência, sem perguntar (ex.: "Novo tipo" na aba da obra). */
  abrangenciaFixa?: Abrangencia;
  /** Texto mostrado no topo do formulário. */
  aviso?: ReactNode;
  onFechar: () => void;
  onSalvo: (tipo: TipoDocumento, novo: boolean) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [nome, setNome] = useState(tipo?.nome ?? '');
  const [instrucoes, setInstrucoes] = useState(tipo?.instrucoes ?? '');
  const [abrangencia, setAbrangencia] = useState<Abrangencia | null>(tipo?.abrangencia ?? abrangenciaFixa ?? null);
  const [opcao, setOpcao] = useState<OpcaoPeriodicidade>(opcaoDe(tipo?.periodicidade));
  const [intervalo, setIntervalo] = useState(
    tipo?.periodicidade && tipo.periodicidade.unidade !== 'UNICA' ? String(tipo.periodicidade.intervalo ?? '') : '',
  );
  const [prazo, setPrazo] = useState(String(tipo?.periodicidade?.prazoDias ?? LIMITES.prazo.padrao));
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    const novosErros: Record<string, string> = {};
    if (nomeLimpo.length < 3 || nomeLimpo.length > 120) novosErros.nome = 'Informe o nome (de 3 a 120 caracteres).';
    if (instrucoes.length > LIMITE_INSTRUCOES) novosErros.instrucoes = 'As instruções podem ter até 1000 caracteres.';
    if (!abrangencia) novosErros.abrangencia = 'Escolha a abrangência: geral da empresa ou por obra.';
    if (personalizado && n === null) novosErros.intervalo = mensagemIntervalo;
    if (periodico && prazoDias === null) novosErros.prazo = 'Informe o prazo de 0 a 90 dias.';
    setErros(novosErros);
    setErroGeral(null);
    if (Object.keys(novosErros).length || !abrangencia) return;

    setSalvando(true);
    try {
      const dados = {
        nome: nomeLimpo,
        instrucoes: instrucoes.trim() || null,
        abrangencia,
        periodicidade: paraPeriodicidade(opcao, n ?? 1, prazoDias ?? LIMITES.prazo.padrao),
      };
      const salvo = tipo ? await api.atualizarTipo(tipo.id, { ...dados, ativo: tipo.ativo }) : await api.criarTipo(dados);
      onSalvo(salvo, !tipo);
    } catch (erro) {
      if (ehSemPermissao(erro)) {
        onSemPermissao(erro.title);
      } else if (erro instanceof ErroApi && erro.code === 'NOME_DUPLICADO') {
        setErros({ nome: erro.title });
      } else if (erro instanceof ErroApi && erro.code === 'ABRANGENCIA_IMUTAVEL') {
        setErros({ abrangencia: erro.title });
      } else if (erro instanceof ErroApi && erro.code === 'PERIODICIDADE_IMUTAVEL') {
        setErros({
          periodicidade: `${erro.title} O prazo pode mudar a qualquer momento; para cobrar de outro jeito, crie um tipo novo.`,
        });
      } else if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setErros({
          nome: erro.erroDoCampo('nome'),
          instrucoes: erro.erroDoCampo('instrucoes'),
          abrangencia: erro.erroDoCampo('abrangencia'),
          periodicidade: erro.erroDoCampo('periodicidade.unidade') ?? erro.erroDoCampo('periodicidade'),
          intervalo: erro.erroDoCampo('periodicidade.intervalo'),
          prazo: erro.erroDoCampo('periodicidade.prazoDias'),
        });
        setErroGeral(erro.title);
      } else {
        setErroGeral(mensagemDeErro(erro));
      }
    } finally {
      setSalvando(false);
    }
  }

  const periodico = opcao !== 'UNICA';
  const personalizado = opcao === 'N_MESES' || opcao === 'N_DIAS';
  const faixa = opcao === 'N_DIAS' ? LIMITES.dias : LIMITES.meses;
  const mensagemIntervalo =
    opcao === 'N_DIAS' ? 'Informe de 1 a 365 dias.' : 'Informe de 1 a 24 meses.';
  const n = personalizado ? inteiroNaFaixa(intervalo, faixa.min, faixa.max) : null;
  const prazoDias = periodico ? inteiroNaFaixa(prazo, LIMITES.prazo.min, LIMITES.prazo.max) : null;
  /** Prévia em texto da regra (FR-332); só quando os números estão válidos. */
  const previa =
    (personalizado && n === null) || (periodico && prazoDias === null)
      ? null
      : previaPeriodicidade(paraPeriodicidade(opcao, n ?? 1, prazoDias ?? 0));
  const mudouPeriodicidade =
    tipo !== null &&
    (() => {
      const atual = tipo.periodicidade;
      const nova = paraPeriodicidade(opcao, n ?? 1, prazoDias ?? 0);
      return atual.unidade !== nova.unidade || (atual.intervalo ?? null) !== (nova.intervalo ?? null);
    })();

  return (
    <Modal
      aberto
      titulo={tipo ? 'Editar tipo de documento' : 'Novo tipo de documento'}
      onFechar={onFechar}
      bloqueado={salvando}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="jn-form-tipo" carregando={salvando} textoCarregando="Salvando…">
            Salvar
          </Botao>
        </>
      }
    >
      <form id="jn-form-tipo" className="jn-pilha" onSubmit={salvar} noValidate>
        {erroGeral ? <Alerta tom="erro">{erroGeral}</Alerta> : null}
        {aviso ? <Alerta tom="info">{aviso}</Alerta> : null}
        <Campo
          rotulo="Nome"
          obrigatorio
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
          placeholder={abrangenciaFixa === 'POR_OBRA' ? 'Ex.: ART da obra' : 'Ex.: Cartão CNPJ'}
          complemento={`${nome.length}/120`}
        />
        {abrangenciaFixa ? null : (
          <fieldset
            className={`jn-opcoes ${erros.abrangencia ? 'jn-opcoes--erro' : ''}`.trim()}
            aria-describedby={erros.abrangencia ? 'jn-tipo-abrangencia-erro' : undefined}
          >
            <legend className="jn-campo__rotulo">
              Abrangência
              <span className="jn-campo__obrigatorio" aria-hidden="true">
                {' '}
                *
              </span>
            </legend>
            {OPCOES_ABRANGENCIA.map((o) => (
              <label key={o.valor} className="jn-caixa-marcacao">
                <input
                  type="radio"
                  name="abrangencia"
                  value={o.valor}
                  checked={abrangencia === o.valor}
                  onChange={() => setAbrangencia(o.valor)}
                />
                <span>
                  <strong>{o.rotulo}</strong> — {o.ajuda}
                </span>
              </label>
            ))}
            {erros.abrangencia ? (
              <p className="jn-campo__erro" id="jn-tipo-abrangencia-erro">
                {erros.abrangencia}
              </p>
            ) : null}
          </fieldset>
        )}
        {tipo?.abrangencia === 'POR_OBRA' && abrangencia === 'GERAL' ? (
          <Alerta tom="aviso">
            Este tipo deixa de ser exigido nas obras que o marcaram e passa a ser pedido de todas as empresas ativas.
            A troca só é aceita se o tipo ainda não tiver envios.
          </Alerta>
        ) : null}
        {tipo?.abrangencia === 'GERAL' && abrangencia === 'POR_OBRA' ? (
          <Alerta tom="aviso">
            Este tipo deixa de ser pedido de todas as empresas e passa a valer só nas obras que o marcarem. A troca só
            é aceita se o tipo ainda não tiver envios.
          </Alerta>
        ) : null}
        <fieldset className="jn-opcoes jn-form-tipo__periodicidade">
          <legend className="jn-campo__rotulo">Periodicidade</legend>
          <CampoSelecao
            rotulo="Com que frequência a empresa envia"
            value={opcao}
            onChange={(e) => {
              setOpcao(e.target.value as OpcaoPeriodicidade);
              setErros((atual) => ({ ...atual, periodicidade: undefined, intervalo: undefined }));
            }}
            erro={erros.periodicidade}
          >
            {OPCOES_PERIODICIDADE.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </CampoSelecao>
          {personalizado ? (
            <Campo
              rotulo={opcao === 'N_DIAS' ? 'A cada quantos dias (N)' : 'A cada quantos meses (N)'}
              obrigatorio
              type="number"
              inputMode="numeric"
              min={faixa.min}
              max={faixa.max}
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
              erro={erros.intervalo}
              ajuda={opcao === 'N_DIAS' ? 'De 1 a 365 dias.' : 'De 1 a 24 meses.'}
            />
          ) : null}
          {periodico ? (
            <Campo
              rotulo="Prazo para enviar (dias após o fim do período)"
              obrigatorio
              type="number"
              inputMode="numeric"
              min={LIMITES.prazo.min}
              max={LIMITES.prazo.max}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              erro={erros.prazo}
              ajuda="De 0 a 90 dias corridos. Passado o prazo sem envio, o período fica “Atrasado”. Pode mudar a qualquer momento."
            />
          ) : null}
          {previa ? (
            <p className="jn-form-tipo__previa" aria-live="polite">
              <strong>Como vai funcionar:</strong> {previa}
            </p>
          ) : null}
          {mudouPeriodicidade ? (
            <Alerta tom="aviso">
              A periodicidade só muda enquanto o tipo não tiver envios. Se já houver envios, a troca é recusada.
            </Alerta>
          ) : null}
        </fieldset>
        <CampoArea
          rotulo="Instruções para a empresa"
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          erro={erros.instrucoes}
          maxLength={LIMITE_INSTRUCOES}
          ajuda="Aparece para a empresa junto do documento. Diga o que enviar e como."
          complemento={`${instrucoes.length}/${LIMITE_INSTRUCOES}`}
          rows={5}
        />
      </form>
    </Modal>
  );
}
