import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/fluig';
import { useConsulta } from '../api/useConsulta';
import { useUsuarioFluig } from '../auth/contexto';
import { Carregando, EstadoErro } from '../components/Estados';
import { IconeAlerta, IconeEmail, IconeEmpresa, IconeFila, IconeObra, IconeSeta } from '../components/icons';
import { TituloPagina } from '../components/TituloPagina';
import './Painel.css';

interface CartaoProps {
  icone: ReactNode;
  numero: number;
  texto: string;
  links: { para: string; rotulo: string }[];
  destaque?: boolean;
}

function CartaoIndicador({ icone, numero, texto, links, destaque }: CartaoProps) {
  return (
    <article className={`jn-indicador ${destaque && numero > 0 ? 'jn-indicador--destaque' : ''}`}>
      <span className="jn-indicador__icone" aria-hidden="true">
        {icone}
      </span>
      <p className="jn-indicador__valor">
        <span className="jn-indicador__numero">{numero}</span>
        <span className="jn-indicador__texto">{texto}</span>
      </p>
      <div className="jn-indicador__links">
        {links.map((l) => (
          <Link key={l.para} className="jn-link-acao" to={l.para}>
            {l.rotulo} <IconeSeta tamanho={16} />
          </Link>
        ))}
      </div>
    </article>
  );
}

export function Painel() {
  const usuario = useUsuarioFluig();
  const consulta = useConsulta((sinal) => api.painel(sinal), []);
  const primeiroNome = usuario.nome.split(' ')[0];
  const p = consulta.dados;

  return (
    <>
      <TituloPagina
        titulo="Painel"
        descricao={`Olá, ${primeiroNome}! Veja o que precisa da sua atenção nos documentos das terceirizadas.`}
      />

      {consulta.carregando && !p ? (
        <Carregando texto="Carregando indicadores…" />
      ) : consulta.erro || !p ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : (
        <>
          <section aria-labelledby="jn-painel-atencao">
            <h2 className="jn-secao__titulo" id="jn-painel-atencao">
              Precisa de atenção
            </h2>
            <div className="jn-painel__grade">
              <CartaoIndicador
                destaque
                icone={<IconeFila tamanho={40} />}
                numero={p.enviosEmAnalise}
                texto={p.enviosEmAnalise === 1 ? 'documento aguardando análise' : 'documentos aguardando análise'}
                links={[{ para: '/analise', rotulo: 'Abrir fila de análise' }]}
              />
              <CartaoIndicador
                destaque
                icone={<IconeAlerta tamanho={40} />}
                numero={p.empresasComPendencia}
                texto={
                  p.empresasComPendencia === 1
                    ? 'empresa com pendência (documento pendente ou rejeitado)'
                    : 'empresas com pendência (documento pendente ou rejeitado)'
                }
                links={[{ para: '/empresas?comPendencia=true', rotulo: 'Ver empresas com pendência' }]}
              />
              <CartaoIndicador
                destaque
                icone={<IconeEmail tamanho={40} />}
                numero={p.empresasConvidadasSemAcesso}
                texto={
                  p.empresasConvidadasSemAcesso === 1
                    ? 'empresa convidada que ainda não acessou o portal'
                    : 'empresas convidadas que ainda não acessaram o portal'
                }
                links={[
                  { para: '/empresas?situacaoAcesso=CONVIDADA', rotulo: 'Convidadas' },
                  { para: '/empresas?situacaoAcesso=CONVITE_EXPIRADO', rotulo: 'Convite expirado' },
                ]}
              />
            </div>
          </section>

          <section className="jn-secao" aria-labelledby="jn-painel-cadastros">
            <h2 className="jn-secao__titulo" id="jn-painel-cadastros">
              Cadastros
            </h2>
            <div className="jn-painel__grade jn-painel__grade--dupla">
              <CartaoIndicador
                icone={<IconeEmpresa tamanho={40} />}
                numero={p.empresasAtivas}
                texto={p.empresasAtivas === 1 ? 'empresa ativa' : 'empresas ativas'}
                links={[{ para: '/empresas', rotulo: 'Ver empresas' }]}
              />
              <CartaoIndicador
                icone={<IconeObra tamanho={40} />}
                numero={p.obrasAtivas}
                texto={p.obrasAtivas === 1 ? 'obra ativa' : 'obras ativas'}
                links={[{ para: '/obras', rotulo: 'Ver obras' }]}
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}
