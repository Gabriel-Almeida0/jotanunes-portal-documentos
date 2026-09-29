using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Jotanunes.Docs.Domain.UsuariosInternos;

namespace Jotanunes.Docs.Application.Dtos;

// Espelham os schemas de contracts/openapi.yaml (serializados em camelCase; enums pelo nome).

/// <summary>Usuário atual da área Jotanunes (schema <c>UsuarioFluig</c>: Fluig ou login próprio).</summary>
public sealed record UsuarioFluigDto(string Login, string Nome, string Email, bool Admin, OrigemSessao Origem, bool TrocaSenhaObrigatoria);

/// <summary><c>FLUIG</c> = token emitido pelo Fluig; <c>LOGIN_LOCAL</c> = login próprio.</summary>
public enum OrigemSessao
{
    FLUIG,
    LOGIN_LOCAL,
}

// ── Login próprio da área Jotanunes (research R17) ──
public sealed record ConfiguracaoAcessoDto(bool LoginLocalHabilitado);

public sealed class LoginJotanunesInput
{
    public string? Login { get; set; }
    public string? Senha { get; set; }
}

public sealed record SessaoJotanunesDto(string AccessToken, DateTimeOffset ExpiraEm, UsuarioFluigDto Usuario)
{
    public static SessaoJotanunesDto De(Portas.TokenJotanunes token, UsuarioInterno u) =>
        new(token.AccessToken, token.ExpiraEm,
            new UsuarioFluigDto(u.Login, u.Nome, u.Email, u.Admin, OrigemSessao.LOGIN_LOCAL, u.TrocaSenhaObrigatoria));
}

// ── Usuários internos ──
public sealed class UsuarioInternoInput
{
    public string? Login { get; set; }
    public string? Nome { get; set; }
    public string? Email { get; set; }
    public bool? Admin { get; set; }
}

public sealed class UsuarioInternoAtualizacao
{
    public string? Nome { get; set; }
    public string? Email { get; set; }
    public bool? Admin { get; set; }
    public bool? Ativo { get; set; }
}

public sealed record UsuarioInternoDto(Guid Id, string Login, string Nome, string Email, bool Admin, bool Ativo,
    SituacaoUsuarioInterno Situacao, DateTimeOffset? SenhaProvisoriaExpiraEm, DateTimeOffset? BloqueadoAte, DateTimeOffset? UltimoAcessoEm,
    DateTimeOffset CriadoEm, string CriadoPor, DateTimeOffset? AtualizadoEm)
{
    /// <summary><c>bloqueadoAte</c> só enquanto o bloqueio por tentativas estiver valendo.</summary>
    public static UsuarioInternoDto De(UsuarioInterno u, DateTimeOffset agora) =>
        new(u.Id, u.Login, u.Nome, u.Email, u.Admin, u.Ativo, u.Situacao(agora),
            u.TrocaSenhaObrigatoria ? u.SenhaProvisoriaExpiraEm : null,
            u.EstaBloqueado(agora) ? u.BloqueadoAte : null,
            u.UltimoAcessoEm, u.CriadoEm, u.CriadoPorLogin, u.AtualizadoEm);
}

public sealed record AutorFluigDto(string Login, string Nome);

public sealed record PainelDto(int EnviosEmAnalise, int EmpresasComPendencia, int EmpresasConvidadasSemAcesso, int EmpresasAtivas, int ObrasAtivas);

public sealed record ContagemDocumentosDto(int Total, int Pendentes, int EmAnalise, int Aprovados, int Rejeitados)
{
    public static ContagemDocumentosDto TudoPendente(int total) => new(total, total, 0, 0, 0);
}

// ── Obras ──
public sealed class ObraInput
{
    public string? Nome { get; set; }
    public string? Codigo { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }
    public bool? Ativa { get; set; }
}

public sealed record ObraDto(Guid Id, string Nome, string? Codigo, string Cidade, Uf Uf, bool Ativa, DateTimeOffset CriadoEm)
{
    public static ObraDto De(Obra o) => new(o.Id, o.Nome, o.Codigo, o.Cidade, o.Uf, o.Ativa, o.CriadoEm);
}

public sealed record ObraResumoDto(Guid Id, string Nome, string? Codigo, string Cidade, Uf Uf, bool Ativa, DateTimeOffset CriadoEm, int QuantidadeEmpresas);

public sealed record ObraDetalheDto(Guid Id, string Nome, string? Codigo, string Cidade, Uf Uf, bool Ativa, DateTimeOffset CriadoEm, IReadOnlyList<EmpresaNaObraDto> Empresas);

public sealed record ObraRefDto(Guid Id, string Nome, string Cidade, Uf Uf)
{
    public static ObraRefDto De(Obra o) => new(o.Id, o.Nome, o.Cidade, o.Uf);
}

public sealed record EmpresaNaObraDto(Guid EmpresaId, string RazaoSocial, string Cnpj, SituacaoAcesso SituacaoAcesso, DateTimeOffset VinculadoEm, ContagemDocumentosDto Documentos);

// ── Empresas ──
public sealed class EmpresaInput
{
    public string? RazaoSocial { get; set; }
    public string? NomeFantasia { get; set; }
    public string? Cnpj { get; set; }
    public string? EmailContato { get; set; }
    public string? NomeContato { get; set; }
    public string? Telefone { get; set; }
    public bool? Ativa { get; set; }
}

public sealed record EmpresaResumoDto(Guid Id, string RazaoSocial, string? NomeFantasia, string Cnpj, string EmailContato, bool Ativa,
    SituacaoAcesso SituacaoAcesso, ContagemDocumentosDto Documentos);

public sealed record EmpresaDto(Guid Id, string RazaoSocial, string? NomeFantasia, string Cnpj, string EmailContato, bool Ativa,
    SituacaoAcesso SituacaoAcesso, ContagemDocumentosDto Documentos, string? NomeContato, string? Telefone,
    IReadOnlyList<ObraRefDto> Obras, bool CnpjEditavel, ConviteDto? UltimoConvite, DateTimeOffset? UltimoAcessoEm, DateTimeOffset CriadoEm);

public sealed record EmpresaRefDto(Guid Id, string RazaoSocial, string Cnpj);

// ── Convites ──
public sealed record ConviteDto(Guid Id, string EmailDestino, DateTimeOffset EnviadoEm, DateTimeOffset ExpiraEm, DateTimeOffset? UsadoEm,
    AutorFluigDto EnviadoPor, SituacaoConvite Situacao)
{
    public static ConviteDto De(Convite c, DateTimeOffset agora) =>
        new(c.Id, c.EmailDestino, c.EnviadoEm, c.ExpiraEm, c.UsadoEm, new AutorFluigDto(c.EnviadoPorLogin, c.EnviadoPorNome), c.Situacao(agora));
}

public sealed record ConviteValidacaoDto(string Cnpj, string RazaoSocial, DateTimeOffset ExpiraEm);

// ── Tipos de documento ──
public sealed class TipoDocumentoInput
{
    public string? Nome { get; set; }
    public string? Instrucoes { get; set; }
    public bool? Ativo { get; set; }
}

public sealed record TipoDocumentoDto(Guid Id, string Nome, string? Instrucoes, bool Ativo, DateTimeOffset CriadoEm)
{
    public static TipoDocumentoDto De(TipoDocumento t) => new(t.Id, t.Nome, t.Instrucoes, t.Ativo, t.CriadoEm);
}

public sealed record TipoDocumentoRefDto(Guid Id, string Nome, string? Instrucoes)
{
    public static TipoDocumentoRefDto De(TipoDocumento t) => new(t.Id, t.Nome, t.Instrucoes);
}

// ── Envios ──
public sealed record EnvioDto(Guid Id, Guid EmpresaId, Guid TipoDocumentoId, string NomeArquivo, string Formato, long TamanhoBytes,
    DateTimeOffset EnviadoEm, StatusEnvio Status, DateTimeOffset? AnalisadoEm, AutorFluigDto? AnalisadoPor, string? MotivoRejeicao)
{
    public static EnvioDto De(EnvioDocumento e) => new(e.Id, e.EmpresaId, e.TipoDocumentoId, e.NomeArquivo, e.ContentType, e.TamanhoBytes,
        e.EnviadoEm, e.Status, e.AnalisadoEm,
        e.AnalisadoPorLogin is null ? null : new AutorFluigDto(e.AnalisadoPorLogin, e.AnalisadoPorNome ?? string.Empty),
        e.MotivoRejeicao);
}

public sealed record EnvioFilaDto(Guid Id, Guid EmpresaId, Guid TipoDocumentoId, string NomeArquivo, string Formato, long TamanhoBytes,
    DateTimeOffset EnviadoEm, StatusEnvio Status, DateTimeOffset? AnalisadoEm, AutorFluigDto? AnalisadoPor, string? MotivoRejeicao,
    EmpresaRefDto Empresa, TipoDocumentoRefDto TipoDocumento)
{
    public static EnvioFilaDto De(EnvioDocumento e, Empresa empresa, TipoDocumento tipo)
    {
        var b = EnvioDto.De(e);
        return new(b.Id, b.EmpresaId, b.TipoDocumentoId, b.NomeArquivo, b.Formato, b.TamanhoBytes, b.EnviadoEm, b.Status, b.AnalisadoEm,
            b.AnalisadoPor, b.MotivoRejeicao, new EmpresaRefDto(empresa.Id, empresa.RazaoSocial, empresa.Cnpj), TipoDocumentoRefDto.De(tipo));
    }
}

public sealed class RejeicaoInput
{
    public string? Motivo { get; set; }
}

public sealed record DocumentoSituacaoDto(TipoDocumentoRefDto TipoDocumento, SituacaoDocumento Situacao, EnvioDto? EnvioAtual, int QuantidadeEnvios);

// ── Portal ──
public sealed class ConviteValidacaoInput
{
    public string? Token { get; set; }
}

public sealed class LoginInput
{
    public string? Cnpj { get; set; }
    public string? Senha { get; set; }
}

public sealed class TrocaSenhaInput
{
    public string? SenhaAtual { get; set; }
    public string? NovaSenha { get; set; }
}

public sealed record EmpresaPortalDto(Guid Id, string RazaoSocial, string? NomeFantasia, string Cnpj, bool TrocaSenhaObrigatoria)
{
    public static EmpresaPortalDto De(Empresa e) => new(e.Id, e.RazaoSocial, e.NomeFantasia, e.Cnpj, e.TrocaSenhaObrigatoria);
}

public sealed record SessaoPortalDto(string AccessToken, DateTimeOffset ExpiraEm, EmpresaPortalDto Empresa);

/// <summary>Visão da empresa: NÃO inclui quem analisou.</summary>
public sealed record EnvioPortalDto(Guid Id, Guid TipoDocumentoId, string NomeArquivo, string Formato, long TamanhoBytes,
    DateTimeOffset EnviadoEm, StatusEnvio Status, DateTimeOffset? AnalisadoEm, string? MotivoRejeicao)
{
    public static EnvioPortalDto De(EnvioDocumento e) =>
        new(e.Id, e.TipoDocumentoId, e.NomeArquivo, e.ContentType, e.TamanhoBytes, e.EnviadoEm, e.Status, e.AnalisadoEm, e.MotivoRejeicao);
}

public sealed record DocumentoSituacaoPortalDto(TipoDocumentoRefDto TipoDocumento, SituacaoDocumento Situacao, EnvioPortalDto? EnvioAtual, bool PodeEnviar);

/// <summary>Arquivo para download (o chamador descarta o stream).</summary>
public sealed record ArquivoDto(Stream Conteudo, string ContentType, string NomeArquivo);
