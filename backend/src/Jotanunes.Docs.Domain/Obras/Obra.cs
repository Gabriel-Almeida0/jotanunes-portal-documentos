using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.Obras;

public sealed class Obra
{
    private Obra() { }

    public Guid Id { get; private set; }
    public string Nome { get; private set; } = string.Empty;
    public string? Codigo { get; private set; }
    public string Cidade { get; private set; } = string.Empty;
    public Uf Uf { get; private set; }
    public bool Ativa { get; private set; }
    public DateTimeOffset CriadoEm { get; private set; }
    public string CriadoPorLogin { get; private set; } = string.Empty;
    public DateTimeOffset? AtualizadoEm { get; private set; }
    public string? AtualizadoPorLogin { get; private set; }

    public static Obra Criar(string? nome, string? codigo, string? cidade, string? uf, string autorLogin, DateTimeOffset agora)
    {
        var obra = new Obra { Id = Guid.NewGuid(), Ativa = true, CriadoEm = agora, CriadoPorLogin = autorLogin };
        obra.Aplicar(nome, codigo, cidade, uf);
        return obra;
    }

    public void Atualizar(string? nome, string? codigo, string? cidade, string? uf, bool ativa, string autorLogin, DateTimeOffset agora)
    {
        Aplicar(nome, codigo, cidade, uf);
        Ativa = ativa;
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    private void Aplicar(string? nome, string? codigo, string? cidade, string? uf)
    {
        var v = new Validacao();
        var n = v.TextoObrigatorio("nome", nome, 3, 150, "o nome da obra");
        var c = v.TextoOpcional("codigo", codigo, 30, "o código");
        var ci = v.TextoObrigatorio("cidade", cidade, 2, 100, "a cidade");
        if (!Ufs.TryParse(uf, out var u)) v.Erro("uf", "Informe uma UF válida.");
        v.LancarSeHouver();
        Nome = n!;
        Codigo = c;
        Cidade = ci!;
        Uf = u;
    }
}
