using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.Empresas;

/// <summary>Nova senha: 8–128 caracteres, ao menos 1 letra e 1 número, diferente da atual.</summary>
public static class PoliticaSenha
{
    public const int Minimo = 8;
    public const int Maximo = 128;
    public const string Mensagem = "A senha precisa ter pelo menos 8 caracteres, com letras e números.";

    public static void Validar(string? novaSenha, string? senhaAtual)
    {
        if (string.IsNullOrEmpty(novaSenha)
            || novaSenha.Length < Minimo
            || novaSenha.Length > Maximo
            || !novaSenha.Any(char.IsLetter)
            || !novaSenha.Any(char.IsDigit))
        {
            throw new ErroDominio(TipoErroDominio.SenhaFraca, Mensagem);
        }

        if (string.Equals(novaSenha, senhaAtual, StringComparison.Ordinal))
        {
            throw new ErroDominio(TipoErroDominio.SenhaFraca, "A nova senha precisa ser diferente da atual.");
        }
    }
}
