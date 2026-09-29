import type { CodigoErro } from './tipos';

/**
 * Mensagens padrão (`title`) da tabela `CodigoErro` do contrato. A tela usa o `title` que vem da
 * API; esta tabela é só o reserva quando a resposta não traz corpo (ex.: queda de rede) e a base
 * dos mocks.
 */
export const MENSAGENS_ERRO: Record<CodigoErro, string> = {
  VALIDACAO: 'Confira os dados informados.',
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre de novo.',
  TROCA_SENHA_OBRIGATORIA: 'Crie uma nova senha para continuar.',
  NAO_ENCONTRADO: 'Não encontramos o que você procurou.',
  CNPJ_DUPLICADO: 'Já existe uma empresa com este CNPJ.',
  CNPJ_IMUTAVEL: 'O CNPJ não pode ser alterado depois do convite.',
  CODIGO_OBRA_DUPLICADO: 'Já existe uma obra com este código.',
  NOME_DUPLICADO: 'Já existe um tipo de documento com este nome.',
  EMPRESA_INATIVA: 'Esta empresa está desativada.',
  CREDENCIAIS_INVALIDAS: 'CNPJ ou senha incorretos.',
  ACESSO_BLOQUEADO: 'Muitas tentativas. Tente de novo em 15 minutos.',
  CONVITE_INVALIDO: 'Este link não é mais válido.',
  CONVITE_EXPIRADO: 'Seu convite expirou. Peça um novo convite à Jotanunes.',
  SENHA_FRACA: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.',
  SENHA_ATUAL_INCORRETA: 'A senha atual não confere.',
  ENVIO_NAO_PERMITIDO: 'Este documento já está em análise ou aprovado.',
  ENVIO_JA_ANALISADO: 'Este envio já foi analisado.',
  ARQUIVO_INVALIDO: 'Não conseguimos ler este arquivo.',
  ARQUIVO_MUITO_GRANDE: 'O arquivo passa de 10 MB.',
  ARQUIVO_TIPO_NAO_SUPORTADO: 'Envie um arquivo PDF, JPG ou PNG.',
  EMAIL_FALHOU: 'Não conseguimos enviar o convite. Tente de novo em alguns minutos.',
  LIMITE_REQUISICOES: 'Muitas tentativas. Aguarde um pouco.',
  ERRO_INTERNO: 'Algo deu errado do nosso lado. Tente de novo.',
};

export const STATUS_ERRO: Record<CodigoErro, number> = {
  VALIDACAO: 400,
  NAO_AUTENTICADO: 401,
  TROCA_SENHA_OBRIGATORIA: 403,
  NAO_ENCONTRADO: 404,
  CNPJ_DUPLICADO: 409,
  CNPJ_IMUTAVEL: 409,
  CODIGO_OBRA_DUPLICADO: 409,
  NOME_DUPLICADO: 409,
  EMPRESA_INATIVA: 409,
  CREDENCIAIS_INVALIDAS: 401,
  ACESSO_BLOQUEADO: 423,
  CONVITE_INVALIDO: 404,
  CONVITE_EXPIRADO: 401,
  SENHA_FRACA: 400,
  SENHA_ATUAL_INCORRETA: 400,
  ENVIO_NAO_PERMITIDO: 409,
  ENVIO_JA_ANALISADO: 409,
  ARQUIVO_INVALIDO: 400,
  ARQUIVO_MUITO_GRANDE: 413,
  ARQUIVO_TIPO_NAO_SUPORTADO: 415,
  EMAIL_FALHOU: 502,
  LIMITE_REQUISICOES: 429,
  ERRO_INTERNO: 500,
};

export const MENSAGEM_SEM_CONEXAO =
  'Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.';
