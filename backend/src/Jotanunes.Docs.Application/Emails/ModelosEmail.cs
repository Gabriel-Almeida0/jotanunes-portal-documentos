using System.Net;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Application.Emails;

/// <summary>Modelos de e-mail (HTML simples com as cores da marca + versão texto).</summary>
public static class ModelosEmail
{
    private static readonly TimeZoneInfo FusoBrasil = ObterFuso();

    public static MensagemEmail Convite(string para, string razaoSocial, string cnpjFormatado, IReadOnlyList<string> obras,
        string link, string senhaTemporaria, DateTimeOffset expiraEm)
    {
        var obrasTexto = obras.Count switch
        {
            0 => "as obras da Jotanunes",
            1 => $"a obra {obras[0]}",
            _ => $"as obras {string.Join(", ", obras.Take(obras.Count - 1))} e {obras[^1]}",
        };
        var validade = FormatarData(expiraEm);
        const string assunto = "Jotanunes: envie os documentos da sua empresa";
        var frase = $"A Jotanunes precisa dos documentos da sua empresa para {obrasTexto}. É só clicar no botão abaixo.";

        var texto = $"""
            Olá, {razaoSocial}!

            {frase}

            Acesse: {link}

            Para entrar, use:
            CNPJ: {cnpjFormatado}
            Senha temporária: {senhaTemporaria}

            No primeiro acesso você vai criar uma nova senha. Este convite vale até {validade}.

            Jotanunes Construtora
            """;

        Func<string, string> e = s => WebUtility.HtmlEncode(s);
        var html = $"""
            <!doctype html>
            <html lang="pt-BR"><body style="margin:0;padding:24px;background:#F2F2F2;font-family:Montserrat,Arial,sans-serif;color:#333333">
            <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:20px 0;padding:32px">
            <div style="width:50px;height:6px;background:#DF1A1A;margin-bottom:16px"></div>
            <h1 style="font-size:22px;margin:0 0 16px">Olá, {e(razaoSocial)}!</h1>
            <p style="font-size:16px;line-height:1.5">{e(frase)}</p>
            <p style="margin:24px 0"><a href="{e(link)}" style="background:#DF1A1A;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:30px;font-weight:600;display:inline-block">Enviar documentos</a></p>
            <p style="font-size:16px;line-height:1.5">Para entrar, use:<br>CNPJ: <strong>{e(cnpjFormatado)}</strong><br>Senha temporária: <strong>{e(senhaTemporaria)}</strong></p>
            <p style="font-size:14px;line-height:1.5">No primeiro acesso você vai criar uma nova senha. Este convite vale até {e(validade)}.</p>
            <p style="font-size:14px;color:#555555">Se o botão não funcionar, copie este endereço: {e(link)}</p>
            <p style="font-size:14px">Jotanunes Construtora</p>
            </div></body></html>
            """;
        return new MensagemEmail(para, assunto, html, texto);
    }

    public static MensagemEmail Rejeicao(string para, string razaoSocial, string tipoDocumento, string motivo, string link)
    {
        var assunto = $"Jotanunes: o documento {tipoDocumento} precisa ser enviado de novo";
        var texto = $"""
            Olá, {razaoSocial}!

            Analisamos o documento "{tipoDocumento}" e ele precisa ser enviado de novo.

            Motivo: {motivo}

            É só acessar o portal e enviar um novo arquivo: {link}

            Jotanunes Construtora
            """;
        Func<string, string> e = s => WebUtility.HtmlEncode(s);
        var html = $"""
            <!doctype html>
            <html lang="pt-BR"><body style="margin:0;padding:24px;background:#F2F2F2;font-family:Montserrat,Arial,sans-serif;color:#333333">
            <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:20px 0;padding:32px">
            <div style="width:50px;height:6px;background:#DF1A1A;margin-bottom:16px"></div>
            <h1 style="font-size:22px;margin:0 0 16px">Olá, {e(razaoSocial)}!</h1>
            <p style="font-size:16px;line-height:1.5">Analisamos o documento <strong>{e(tipoDocumento)}</strong> e ele precisa ser enviado de novo.</p>
            <p style="font-size:16px;line-height:1.5"><strong>Motivo:</strong> {e(motivo)}</p>
            <p style="margin:24px 0"><a href="{e(link)}" style="background:#DF1A1A;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:30px;font-weight:600;display:inline-block">Enviar novo arquivo</a></p>
            <p style="font-size:14px">Jotanunes Construtora</p>
            </div></body></html>
            """;
        return new MensagemEmail(para, assunto, html, texto);
    }

    private static string FormatarData(DateTimeOffset data) =>
        TimeZoneInfo.ConvertTime(data, FusoBrasil).ToString("dd/MM/yyyy 'às' HH:mm", System.Globalization.CultureInfo.InvariantCulture);

    private static TimeZoneInfo ObterFuso()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "BRT", "BRT"); }
    }
}
