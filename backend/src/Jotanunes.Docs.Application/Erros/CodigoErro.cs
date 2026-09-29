namespace Jotanunes.Docs.Application.Erros;

/// <summary>Mesmos valores do enum <c>CodigoErro</c> do contrato (openapi.yaml).</summary>
public enum CodigoErro
{
    VALIDACAO,
    NAO_AUTENTICADO,
    TROCA_SENHA_OBRIGATORIA,
    SEM_PERMISSAO,
    NAO_ENCONTRADO,
    CNPJ_DUPLICADO,
    CNPJ_IMUTAVEL,
    CODIGO_OBRA_DUPLICADO,
    NOME_DUPLICADO,
    EMPRESA_INATIVA,
    CREDENCIAIS_INVALIDAS,
    ACESSO_BLOQUEADO,
    CONVITE_INVALIDO,
    CONVITE_EXPIRADO,
    SENHA_FRACA,
    SENHA_ATUAL_INCORRETA,
    ENVIO_NAO_PERMITIDO,
    ENVIO_JA_ANALISADO,
    ARQUIVO_INVALIDO,
    ARQUIVO_MUITO_GRANDE,
    ARQUIVO_TIPO_NAO_SUPORTADO,
    EMAIL_FALHOU,
    LIMITE_REQUISICOES,
    ERRO_INTERNO,
}

/// <summary>Status HTTP e mensagem padrão (title) de cada código — tabela do contrato.</summary>
public static class CatalogoErros
{
    public static (int Status, string Titulo) Obter(CodigoErro codigo) => codigo switch
    {
        CodigoErro.VALIDACAO => (400, "Confira os dados informados."),
        CodigoErro.NAO_AUTENTICADO => (401, "Sua sessão expirou. Entre de novo."),
        CodigoErro.TROCA_SENHA_OBRIGATORIA => (403, "Crie uma nova senha para continuar."),
        CodigoErro.SEM_PERMISSAO => (403, "Só administradores podem fazer isso. Se você precisa, fale com a TI."),
        CodigoErro.NAO_ENCONTRADO => (404, "Não encontramos o que você procurou."),
        CodigoErro.CNPJ_DUPLICADO => (409, "Já existe uma empresa com este CNPJ."),
        CodigoErro.CNPJ_IMUTAVEL => (409, "O CNPJ não pode ser alterado depois do convite."),
        CodigoErro.CODIGO_OBRA_DUPLICADO => (409, "Já existe uma obra com este código."),
        CodigoErro.NOME_DUPLICADO => (409, "Já existe um tipo de documento com este nome."),
        CodigoErro.EMPRESA_INATIVA => (409, "Esta empresa está desativada."),
        CodigoErro.CREDENCIAIS_INVALIDAS => (401, "CNPJ ou senha incorretos."),
        CodigoErro.ACESSO_BLOQUEADO => (423, "Muitas tentativas. Tente de novo em 15 minutos."),
        CodigoErro.CONVITE_INVALIDO => (404, "Este link não é mais válido."),
        CodigoErro.CONVITE_EXPIRADO => (401, "Seu convite expirou. Peça um novo convite à Jotanunes."),
        CodigoErro.SENHA_FRACA => (400, "A senha precisa ter pelo menos 8 caracteres, com letras e números."),
        CodigoErro.SENHA_ATUAL_INCORRETA => (400, "A senha atual não confere."),
        CodigoErro.ENVIO_NAO_PERMITIDO => (409, "Este documento já está em análise ou aprovado."),
        CodigoErro.ENVIO_JA_ANALISADO => (409, "Este envio já foi analisado."),
        CodigoErro.ARQUIVO_INVALIDO => (400, "Não conseguimos ler este arquivo."),
        CodigoErro.ARQUIVO_MUITO_GRANDE => (413, "O arquivo passa de 10 MB."),
        CodigoErro.ARQUIVO_TIPO_NAO_SUPORTADO => (415, "Envie um arquivo PDF, JPG ou PNG."),
        CodigoErro.EMAIL_FALHOU => (502, "Não conseguimos enviar o convite. Tente de novo em alguns minutos."),
        CodigoErro.LIMITE_REQUISICOES => (429, "Muitas tentativas. Aguarde um pouco."),
        _ => (500, "Algo deu errado do nosso lado. Tente de novo."),
    };
}
