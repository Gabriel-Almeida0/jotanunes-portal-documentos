namespace Jotanunes.Docs.Domain.Envios;

/// <summary>Deriva a situação do documento (empresa × tipo) a partir dos envios. Ver data-model §6.</summary>
public static class RegraSituacaoDocumento
{
    public static (SituacaoDocumento Situacao, EnvioDocumento? EnvioAtual) De(IEnumerable<EnvioDocumento> envios)
    {
        EnvioDocumento? vivo = null;
        EnvioDocumento? ultimoRejeitado = null;
        foreach (var e in envios)
        {
            if (e.Status == StatusEnvio.REJEITADO)
            {
                if (ultimoRejeitado is null || e.EnviadoEm > ultimoRejeitado.EnviadoEm) ultimoRejeitado = e;
            }
            else if (vivo is null || e.EnviadoEm > vivo.EnviadoEm)
            {
                vivo = e;
            }
        }

        if (vivo is not null)
        {
            return (vivo.Status == StatusEnvio.APROVADO ? SituacaoDocumento.APROVADO : SituacaoDocumento.EM_ANALISE, vivo);
        }
        return ultimoRejeitado is not null
            ? (SituacaoDocumento.REJEITADO, ultimoRejeitado)
            : (SituacaoDocumento.PENDENTE_ENVIO, null);
    }

    public static bool PodeEnviar(SituacaoDocumento situacao, bool empresaAtiva, bool tipoAtivo) =>
        empresaAtiva && tipoAtivo && situacao is SituacaoDocumento.PENDENTE_ENVIO or SituacaoDocumento.REJEITADO;
}
