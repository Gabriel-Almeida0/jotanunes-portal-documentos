import { Link } from 'react-router-dom';
import type { ObraPortal } from '../api/tipos';
import { caminhoLista } from '../utils/contexto';
import { IconePin, IconeSetaDireita } from './icons';
import './Selo.css';
import './CartaoObra.css';

const plural = (n: number, singular: string, varios: string) => (n === 1 ? singular : varios);

/** Progresso escrito, ex.: "2 de 3 aprovados" (a barra é só reforço visual). */
function textoProgresso({ total, aprovados }: ObraPortal['documentos']): string {
  return `${aprovados} de ${total} ${plural(total, 'aprovado', 'aprovados')}`;
}

/** Selos de texto com o que precisa de atenção na obra (a cor é só reforço). */
function selos({
  total,
  pendentes,
  rejeitados,
  emAnalise,
  aprovados,
  periodosAtrasados,
}: ObraPortal['documentos']) {
  if (total === 0) return [{ classe: 'neutro', texto: 'Nenhum documento exigido' }];
  const lista: { classe: string; texto: string }[] = [];
  if (periodosAtrasados > 0) {
    lista.push({
      classe: 'atrasado',
      texto: `${periodosAtrasados} ${plural(periodosAtrasados, 'período atrasado', 'períodos atrasados')}`,
    });
  }
  if (rejeitados > 0) {
    lista.push({
      classe: 'rejeitado',
      texto: `${rejeitados} ${plural(rejeitados, 'rejeitado', 'rejeitados')}`,
    });
  }
  if (pendentes > 0) {
    lista.push({
      classe: 'pendente_envio',
      texto: `${pendentes} ${plural(pendentes, 'pendente de envio', 'pendentes de envio')}`,
    });
  }
  if (emAnalise > 0) lista.push({ classe: 'em_analise', texto: `${emAnalise} em análise` });
  if (aprovados === total) lista.push({ classe: 'aprovado', texto: 'Tudo certo' });
  return lista;
}

/** Cartão de uma obra no resumo do portal: nome, cidade/UF, progresso e pendências. */
export function CartaoObra({ obra }: { obra: ObraPortal }) {
  const { documentos } = obra;
  const idTitulo = `obra-${obra.id}`;
  const comPendencia =
    documentos.pendentes + documentos.rejeitados + documentos.periodosAtrasados > 0;
  const percentual = documentos.total ? (documentos.aprovados / documentos.total) * 100 : 0;

  return (
    <article
      className={`jn-obra${comPendencia ? ' jn-obra--pendente' : ''}`}
      aria-labelledby={idTitulo}
      data-testid="cartao-obra"
    >
      <h3 id={idTitulo} className="jn-obra__nome">
        <Link to={caminhoLista(obra.id)} className="jn-obra__link">
          {obra.nome}
        </Link>
      </h3>
      <p className="jn-obra__local">
        <IconePin tamanho={16} className="jn-obra__pin" />
        {obra.cidade}/{obra.uf}
      </p>

      {documentos.total > 0 && (
        <div className="jn-obra__progresso">
          <span className="jn-obra__progresso-texto">{textoProgresso(documentos)}</span>
          <span className="jn-obra__barra" aria-hidden="true">
            <span style={{ width: `${percentual}%` }} />
          </span>
        </div>
      )}

      <ul className="jn-obra__selos" aria-label="Situação dos documentos da obra">
        {selos(documentos).map(({ classe, texto }) => (
          <li key={classe} className={`jn-selo jn-selo--${classe}`}>
            {texto}
          </li>
        ))}
      </ul>

      <span className="jn-obra__abrir" aria-hidden="true">
        Ver documentos da obra
        <IconeSetaDireita tamanho={16} />
      </span>
    </article>
  );
}
