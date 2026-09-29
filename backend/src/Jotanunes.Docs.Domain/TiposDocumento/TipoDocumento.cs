using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.TiposDocumento;

/// <summary>Tipo de documento. Todo tipo ativo é exigido de toda empresa ativa.</summary>
public sealed class TipoDocumento
{
    private TipoDocumento() { }

    public Guid Id { get; private set; }
    public string Nome { get; private set; } = string.Empty;
    public string? Instrucoes { get; private set; }
    public bool Ativo { get; private set; }
    public DateTimeOffset CriadoEm { get; private set; }
    public string CriadoPorLogin { get; private set; } = string.Empty;
    public DateTimeOffset? AtualizadoEm { get; private set; }
    public string? AtualizadoPorLogin { get; private set; }

    public static TipoDocumento Criar(string? nome, string? instrucoes, string autorLogin, DateTimeOffset agora)
    {
        var t = new TipoDocumento { Id = Guid.NewGuid(), Ativo = true, CriadoEm = agora, CriadoPorLogin = autorLogin };
        t.Aplicar(nome, instrucoes);
        return t;
    }

    public void Atualizar(string? nome, string? instrucoes, bool ativo, string autorLogin, DateTimeOffset agora)
    {
        Aplicar(nome, instrucoes);
        Ativo = ativo;
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    private void Aplicar(string? nome, string? instrucoes)
    {
        var v = new Validacao();
        var n = v.TextoObrigatorio("nome", nome, 3, 120, "o nome do tipo de documento");
        var i = v.TextoOpcional("instrucoes", instrucoes, 1000, "as instruções");
        v.LancarSeHouver();
        Nome = n!;
        Instrucoes = i;
    }
}
