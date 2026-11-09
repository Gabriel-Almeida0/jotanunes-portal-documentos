import { Link } from 'react-router-dom';
import type { EmpresaNaObra, ObraDetalhe } from '../../api/tipos';
import { useEhAdmin } from '../../auth/contexto';
import { Botao } from '../../components/Botao';
import { EstadoVazio } from '../../components/Estados';
import { IconeEmpresa, IconeMais, IconeSeta } from '../../components/icons';
import { ResumoDocumentos } from '../../components/ResumoDocumentos';
import { SeloSituacao } from '../../components/Selo';
import { SomenteAdmin } from '../../components/SomenteAdmin';
import { Tabela } from '../../components/Tabela';
import { formatarCnpj } from '../../utils/cnpj';
import { formatarData } from '../../utils/datas';
import { caminhoEmpresaNaObra } from './caminhos';

/**
 * Aba "Empresas" do detalhe da obra (FR-240): cada empresa com vínculo ativo, com o progresso dos
 * documentos desta obra e, à parte, o dos documentos gerais.
 */
export function AbaEmpresas({
  obra,
  onVincular,
  onEncerrar,
}: {
  obra: ObraDetalhe;
  onVincular: () => void;
  onEncerrar: (empresa: EmpresaNaObra) => void;
}) {
  const ehAdmin = useEhAdmin();

  return (
    <section aria-labelledby="jn-empresas-da-obra">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-empresas-da-obra">
            Empresas da obra
          </h2>
          <p className="jn-secao__descricao">
            {obra.empresas.length === 1 ? '1 empresa vinculada' : `${obra.empresas.length} empresas vinculadas`}.
            Progresso dos documentos desta obra e, à parte, dos documentos gerais de cada empresa.
          </p>
        </div>
        <SomenteAdmin>
          <Botao icone={<IconeMais tamanho={18} />} onClick={onVincular}>
            Vincular empresa
          </Botao>
        </SomenteAdmin>
      </div>

      {obra.empresas.length === 0 ? (
        <EstadoVazio
          icone={<IconeEmpresa tamanho={32} />}
          titulo="Nenhuma empresa vinculada a esta obra."
          texto={
            ehAdmin
              ? 'Vincule as empresas terceirizadas que trabalham aqui para acompanhar os documentos delas.'
              : 'Quando um administrador vincular empresas a esta obra, elas aparecem aqui.'
          }
          acao={
            ehAdmin ? (
              <Botao icone={<IconeMais tamanho={18} />} onClick={onVincular}>
                Vincular empresa
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <Tabela rotulo="Empresas da obra">
          <thead>
            <tr>
              <th scope="col">Empresa</th>
              <th scope="col">Acesso ao portal</th>
              <th scope="col">Documentos</th>
              <th scope="col">Vinculada em</th>
              <th scope="col" className="jn-tabela__acoes">
                <span className="jn-sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {obra.empresas.map((e) => (
              <tr key={e.empresaId}>
                <td>
                  <Link to={caminhoEmpresaNaObra(e.empresaId, obra.id)} className="jn-tabela__principal">
                    {e.razaoSocial}
                  </Link>
                  <span className="jn-tabela__sub jn-mono">{formatarCnpj(e.cnpj)}</span>
                </td>
                <td>
                  <SeloSituacao situacao={e.situacaoAcesso} />
                </td>
                <td>
                  <div className="jn-contagens">
                    <ResumoDocumentos contagem={e.documentosObra} rotulo="Documentos desta obra" />
                    <ResumoDocumentos contagem={e.documentosGerais} rotulo="Gerais" compacto />
                  </div>
                </td>
                <td className="jn-tabela__nowrap">{formatarData(e.vinculadoEm)}</td>
                <td className="jn-tabela__acoes">
                  <span className="jn-acoes-linha">
                    <Link
                      className="jn-link-acao"
                      to={caminhoEmpresaNaObra(e.empresaId, obra.id)}
                      aria-label={`Ver empresa ${e.razaoSocial}`}
                    >
                      Ver empresa <IconeSeta tamanho={16} />
                    </Link>
                    <SomenteAdmin>
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        onClick={() => onEncerrar(e)}
                        aria-label={`Encerrar vínculo de ${e.razaoSocial}`}
                      >
                        Encerrar vínculo
                      </Botao>
                    </SomenteAdmin>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}
