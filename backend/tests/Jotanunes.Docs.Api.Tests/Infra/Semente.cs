using System.Net.Http.Json;
using System.Text.Json;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Jotanunes.Docs.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>Helpers que criam dados direto no banco (sem passar pela API).</summary>
public sealed class Semente(ApiFactory api)
{
    public const string SenhaPadrao = "SenhaBoa123";
    private static readonly BCryptHasherSenha Hasher = new();
    private static readonly Lazy<string> HashSenhaPadrao = new(() => Hasher.Gerar(SenhaPadrao));
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> Hashes = new();

    /// <summary>Hash BCrypt (custo 12) em cache por senha: semear muitos usuários não custa 250 ms cada.</summary>
    public static string HashDe(string senha) => Hashes.GetOrAdd(senha, Hasher.Gerar);

    public DateTimeOffset Agora => api.Relogio.GetUtcNow();

    public async Task<Obra> ObraAsync(string? nome = null, string? codigo = null, bool ativa = true)
    {
        var o = Obra.Criar(nome ?? "Obra " + Guid.NewGuid().ToString("N")[..8], codigo, "Aracaju", "SE", "semente", Agora);
        if (!ativa) o.Atualizar(o.Nome, o.Codigo, o.Cidade, o.Uf.ToString(), false, "semente", Agora);
        await api.NoBancoAsync(async db => { db.Obras.Add(o); await db.SaveChangesAsync(); });
        return o;
    }

    public async Task<TipoDocumento> TipoAsync(string? nome = null, bool ativo = true)
    {
        var t = TipoDocumento.Criar(nome ?? "Tipo " + Guid.NewGuid().ToString("N")[..8], "Instruções do tipo", "semente", Agora);
        if (!ativo) t.Atualizar(t.Nome, t.Instrucoes, false, "semente", Agora);
        await api.NoBancoAsync(async db => { db.TiposDocumento.Add(t); await db.SaveChangesAsync(); });
        return t;
    }

    public async Task<Empresa> EmpresaAsync(string? razao = null, string? cnpj = null, bool ativa = true, string? email = null)
    {
        var e = Empresa.Criar(razao ?? "Empresa " + Guid.NewGuid().ToString("N")[..8], null, cnpj ?? CnpjTeste.Gerar(),
            email ?? $"contato-{Guid.NewGuid():N}@empresa.test", null, null, "semente", Agora);
        if (!ativa) e.Desativar("semente", Agora);
        await api.NoBancoAsync(async db => { db.Empresas.Add(e); await db.SaveChangesAsync(); });
        return e;
    }

    /// <summary>Empresa que já trocou a senha (situação ATIVA), com senha <see cref="SenhaPadrao"/>.</summary>
    public async Task<(Empresa Empresa, string Token)> EmpresaComAcessoAsync(string? razao = null)
    {
        var e = Empresa.Criar(razao ?? "Empresa " + Guid.NewGuid().ToString("N")[..8], null, CnpjTeste.Gerar(),
            $"contato-{Guid.NewGuid():N}@empresa.test", null, null, "semente", Agora);
        e.RegistrarConvite(HashSenhaPadrao.Value, Agora);
        e.TrocarSenha(HashSenhaPadrao.Value, Agora);
        await api.NoBancoAsync(async db => { db.Empresas.Add(e); await db.SaveChangesAsync(); });
        return (e, Tokens.Portal(api, e.Id, e.Cnpj, e.VersaoCredencial, trocaSenha: false));
    }

    public async Task VincularAsync(Obra obra, Empresa empresa) =>
        await api.NoBancoAsync(async db => { db.ObraEmpresas.Add(new ObraEmpresa(obra.Id, empresa.Id, "semente", Agora)); await db.SaveChangesAsync(); });

    public async Task<EnvioDocumento> EnvioAsync(Empresa empresa, TipoDocumento tipo, StatusEnvio status = StatusEnvio.EM_ANALISE,
        string motivo = "Documento ilegível", byte[]? conteudo = null)
    {
        conteudo ??= ArquivosTeste.Pdf();
        var envio = EnvioDocumento.Criar(Guid.NewGuid(), empresa.Id, tipo.Id, "doc.pdf", "application/pdf", conteudo.Length,
            Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(conteudo)).ToLowerInvariant(), Agora);
        if (status == StatusEnvio.APROVADO) envio.Aprovar("analista", "Analista", Agora);
        if (status == StatusEnvio.REJEITADO) envio.Rejeitar("analista", "Analista", motivo, Agora);
        var caminho = Path.Combine(api.DiretorioArquivos, envio.ChaveArmazenamento);
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);
        await File.WriteAllBytesAsync(caminho, conteudo);
        await api.NoBancoAsync(async db => { db.Envios.Add(envio); await db.SaveChangesAsync(); });
        return envio;
    }

    /// <summary>
    /// Usuário interno gravado direto no banco (hash BCrypt de <paramref name="senha"/>). Padrão: comum, ativo, com a senha
    /// já definida (sem troca pendente) e versão 0. Com <paramref name="trocaSenhaObrigatoria"/>, a provisória vence em
    /// <paramref name="senhaProvisoriaExpiraEm"/> (padrão: agora + 7 dias).
    /// </summary>
    public async Task<UsuarioInterno> UsuarioInternoAsync(string? login = null, string? nome = null, string? email = null, bool admin = false,
        bool ativo = true, string senha = SenhaPadrao, bool trocaSenhaObrigatoria = false, DateTimeOffset? senhaProvisoriaExpiraEm = null)
    {
        login ??= "usuario." + Guid.NewGuid().ToString("N")[..8];
        var u = UsuarioInterno.Criar(login, nome ?? "Usuário " + login, email ?? $"{login}@jotanunes.com", admin, HashDe(senha), "semente", Agora);
        await api.NoBancoAsync(async db =>
        {
            db.UsuariosInternos.Add(u);
            var e = db.Entry(u);
            e.Property(x => x.Ativo).CurrentValue = ativo;
            e.Property(x => x.TrocaSenhaObrigatoria).CurrentValue = trocaSenhaObrigatoria;
            e.Property(x => x.SenhaProvisoriaExpiraEm).CurrentValue = trocaSenhaObrigatoria ? senhaProvisoriaExpiraEm ?? Agora.AddDays(7) : null;
            await db.SaveChangesAsync();
        });
        return await RecarregarUsuarioAsync(u.Id);
    }

    public Task<UsuarioInterno> RecarregarUsuarioAsync(Guid id) =>
        api.NoBancoAsync(db => db.UsuariosInternos.AsNoTracking().SingleAsync(u => u.Id == id));

    public Task<List<UsuarioInterno>> UsuariosInternosAsync() =>
        api.NoBancoAsync(db => db.UsuariosInternos.AsNoTracking().OrderBy(u => u.Login).ToListAsync());

    public Task<Empresa> RecarregarEmpresaAsync(Guid id) =>
        api.NoBancoAsync(db => db.Empresas.AsNoTracking().SingleAsync(e => e.Id == id));

    public Task<List<Convite>> ConvitesAsync(Guid empresaId) =>
        api.NoBancoAsync(db => db.Convites.AsNoTracking().Where(c => c.EmpresaId == empresaId).OrderBy(c => c.EnviadoEm).ToListAsync());
}

public static class CnpjTeste
{
    /// <summary>CNPJ numérico aleatório com DV válido.</summary>
    public static string Gerar()
    {
        while (true)
        {
            var baseCnpj = string.Concat(Enumerable.Range(0, 12).Select(_ => (char)('0' + Random.Shared.Next(10))));
            for (var dv = 0; dv < 100; dv++)
            {
                var c = baseCnpj + dv.ToString("00");
                if (Cnpj.EhValido(c)) return c;
            }
        }
    }

    public static string Mascarar(string c) => Cnpj.Criar(c).Formatado;
}

public static class ArquivosTeste
{
    /// <summary>PDF com o tamanho pedido: cabeçalho <c>%PDF-</c> e <c>%%EOF</c> no final (passa na checagem de integridade).</summary>
    public static byte[] Pdf(int tamanho = 1024)
    {
        var fim = "\n%%EOF\n"u8;
        var b = new byte[Math.Max(tamanho, 16)];
        "%PDF-1.4\n"u8.CopyTo(b);
        for (var i = 9; i < b.Length - fim.Length; i++) b[i] = (byte)('a' + i % 26);
        fim.CopyTo(b.AsSpan(b.Length - fim.Length));
        return b;
    }

    /// <summary>PNG real de 1×1 pixel (assinatura, IHDR, IDAT e IEND).</summary>
    public static byte[] Png() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    /// <summary>JPEG mínimo: SOI + APP0 (JFIF) + EOI.</summary>
    public static byte[] Jpeg() =>
        [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9];

    /// <summary>Arquivo cortado no meio (perde o fim), como um upload interrompido.</summary>
    public static byte[] Truncar(byte[] arquivo, int manter) => arquivo[..manter];

    public static byte[] Exe() => [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 1, 2, 3, 4];

    public static MultipartFormDataContent Form(byte[] conteudo, string nome = "documento.pdf", string campo = "arquivo", string contentType = "application/pdf")
    {
        var form = new MultipartFormDataContent();
        var arquivo = new ByteArrayContent(conteudo);
        arquivo.Headers.ContentType = new(contentType);
        form.Add(arquivo, campo, nome);
        return form;
    }
}

public static class Json
{
    public static async Task<JsonElement> LerAsync(this HttpResponseMessage r)
    {
        await r.Content.LoadIntoBufferAsync();
        using var doc = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    public static async Task<string> CodigoAsync(this HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.LerAsync()).GetProperty("code").GetString()!;
    }

    public static string Str(this JsonElement e, string prop) => e.GetProperty(prop).GetString()!;

    public static Guid Id(this JsonElement e, string prop = "id") => e.GetProperty(prop).GetGuid();
}
