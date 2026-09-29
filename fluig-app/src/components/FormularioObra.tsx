import { useState, type FormEvent } from 'react';
import { ErroApi, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Obra, Uf } from '../api/tipos';
import { UFS } from '../utils/formatos';
import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { Campo, CampoSelecao } from './Campo';
import { Modal } from './Modal';

type Erros = Partial<Record<'nome' | 'codigo' | 'cidade' | 'uf', string>>;

/** Modal de cadastro/edição de obra (ObraInput / ObraAtualizacao do contrato). */
export function FormularioObra({
  obra,
  onFechar,
  onSalvo,
}: {
  obra: Obra | null;
  onFechar: () => void;
  onSalvo: (obra: Obra) => void;
}) {
  const [nome, setNome] = useState(obra?.nome ?? '');
  const [codigo, setCodigo] = useState(obra?.codigo ?? '');
  const [cidade, setCidade] = useState(obra?.cidade ?? '');
  const [uf, setUf] = useState<string>(obra?.uf ?? '');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados = { nome: nome.trim(), codigo: codigo.trim() || null, cidade: cidade.trim(), uf: uf as Uf };
    const novos: Erros = {};
    if (dados.nome.length < 3 || dados.nome.length > 150) novos.nome = 'Informe o nome da obra (de 3 a 150 caracteres).';
    if (dados.codigo && dados.codigo.length > 30) novos.codigo = 'O código pode ter até 30 caracteres.';
    if (dados.cidade.length < 2 || dados.cidade.length > 100) novos.cidade = 'Informe a cidade (de 2 a 100 caracteres).';
    if (!uf) novos.uf = 'Escolha a UF.';
    setErros(novos);
    setErroGeral(null);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      const salva = obra
        ? await api.atualizarObra(obra.id, { ...dados, ativa: obra.ativa })
        : await api.criarObra(dados);
      onSalvo(salva);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'CODIGO_OBRA_DUPLICADO') {
        setErros({ codigo: erro.title });
      } else if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setErros({
          nome: erro.erroDoCampo('nome'),
          codigo: erro.erroDoCampo('codigo'),
          cidade: erro.erroDoCampo('cidade'),
          uf: erro.erroDoCampo('uf'),
        });
        setErroGeral(erro.title);
      } else {
        setErroGeral(mensagemDeErro(erro));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      titulo={obra ? 'Editar obra' : 'Nova obra'}
      onFechar={onFechar}
      bloqueado={salvando}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="jn-form-obra" carregando={salvando} textoCarregando="Salvando…">
            Salvar
          </Botao>
        </>
      }
    >
      <form id="jn-form-obra" className="jn-grade-form" onSubmit={salvar} noValidate>
        {erroGeral ? (
          <div className="jn-grade-form__inteiro">
            <Alerta tom="erro">{erroGeral}</Alerta>
          </div>
        ) : null}
        <Campo
          className="jn-grade-form__inteiro"
          rotulo="Nome da obra"
          obrigatorio
          maxLength={150}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
          placeholder="Ex.: Residencial Vista do Rio"
        />
        <Campo
          rotulo="Cidade"
          obrigatorio
          maxLength={100}
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          erro={erros.cidade}
        />
        <CampoSelecao rotulo="UF" obrigatorio value={uf} onChange={(e) => setUf(e.target.value)} erro={erros.uf}>
          <option value="">Selecionar</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </CampoSelecao>
        <Campo
          className="jn-grade-form__inteiro"
          rotulo="Código"
          maxLength={30}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          erro={erros.codigo}
          ajuda="Opcional. Código interno da obra."
        />
      </form>
    </Modal>
  );
}
