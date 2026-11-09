import { Link } from 'react-router-dom';
import type { ObraDetalhe, VinculoEncerrado } from '../../api/tipos';
import { Botao } from '../../components/Botao';
import { EstadoVazio } from '../../components/Estados';
import { IconeSeta } from '../../components/icons';
import { SomenteAdmin } from '../../components/SomenteAdmin';
import { Tabela } from '../../components/Tabela';
import { formatarCnpj } from '../../utils/cnpj';
import { formatarDataHora } from '../../utils/datas';
import { caminhoEmpresaNaObra } from './caminhos';

function textoEnvios(n: number): string {
  if (n === 0) return 'Nenhum envio';
  return n === 1 ? '1 envio' : `${n} envios`;
}

/**
 * Aba "Vínculos encerrados" do detalhe da obra (US5, FR-220/FR-240): empresas desvinculadas, com
 * quem encerrou e quando. O histórico de envios continua consultável no detalhe da empresa, no
 * bloco desta obra; o administrador pode vincular de novo (reabre o mesmo vínculo).
 */
export function AbaVinculosEncerrados({
  obra,
  reabrindoId,
  onReabrir,
}: {
  obra: ObraDetalhe;
  reabrindoId: string | null;
  onReabrir: (vinculo: VinculoEncerrado) => void;
}) {
  const vinculos = obra.vinculosEncerrados;

  return (
    <section aria-labelledby="jn-vinculos-encerrados-titulo">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-vinculos-encerrados-titulo">
            Vínculos encerrados
          </h2>
          <p className="jn-secao__descricao">
            Empresas que já trabalharam nesta obra. Elas não veem mais a obra no portal, mas os envios e as análises
            continuam guardados.
          </p>
        </div>
      </div>

      {vinculos.length === 0 ? (
        <EstadoVazio titulo="Nenhum vínculo encerrado nesta obra." />
      ) : (
        <Tabela rotulo="Vínculos encerrados">
          <thead>
            <tr>
              <th scope="col">Empresa</th>
              <th scope="col">Encerrado em</th>
              <th scope="col">Envios nesta obra</th>
              <th scope="col" className="jn-tabela__acoes">
                <span className="jn-sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vinculos.map((v) => (
              <tr key={v.empresaId}>
                <td>
                  <span className="jn-tabela__principal">{v.razaoSocial}</span>
                  <span className="jn-tabela__sub jn-mono">{formatarCnpj(v.cnpj)}</span>
                </td>
                <td>
                  <span className="jn-tabela__nowrap">{formatarDataHora(v.encerradoEm)}</span>
                  <span className="jn-tabela__sub">por {v.encerradoPorLogin ?? '—'}</span>
                </td>
                <td>{textoEnvios(v.quantidadeEnvios)}</td>
                <td className="jn-tabela__acoes">
                  <span className="jn-acoes-linha">
                    <Link
                      className="jn-link-acao"
                      to={caminhoEmpresaNaObra(v.empresaId, obra.id)}
                      aria-label={`Ver histórico de ${v.razaoSocial} nesta obra`}
                    >
                      Ver histórico <IconeSeta tamanho={16} />
                    </Link>
                    <SomenteAdmin>
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        carregando={reabrindoId === v.empresaId}
                        disabled={Boolean(reabrindoId)}
                        onClick={() => onReabrir(v)}
                        aria-label={`Reabrir vínculo de ${v.razaoSocial}`}
                      >
                        Reabrir vínculo
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
