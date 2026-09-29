import type { CodigoErro } from './tipos';

/**
 * Mensagens padrão (`title`) da tabela `CodigoErro` do contrato. Usadas quando o servidor não
 * devolve `title` (ex.: erro de rede) e na validação do cliente, para falar igual ao servidor.
 */
export const MENSAGENS: Record<CodigoErro, string> = {
  VALIDACAO: 'Confira os dados informados.',
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre de novo.',
  TROCA_SENHA_OBRIGATORIA: 'Crie uma nova senha para continuar.',
  // Só da área Jotanunes (perfil do Fluig); o portal nunca recebe este código.
  SEM_PERMISSAO: 'Só administradores podem fazer isso. Se você precisa, fale com a TI.',
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
  // Só do login próprio da área Jotanunes e da gestão de usuários internos (contrato 1.2.0); o portal
  // nunca recebe estes códigos. Estão aqui porque o mapa cobre todo o enum CodigoErro.
  LOGIN_INVALIDO: 'Login ou senha incorretos.',
  USUARIO_INATIVO: 'Este usuário está desativado. Fale com um administrador do sistema.',
  SENHA_PROVISORIA_EXPIRADA: 'Sua senha provisória expirou. Peça a um administrador para gerar outra.',
  LOGIN_DUPLICADO: 'Já existe um usuário com este login.',
  ULTIMO_ADMINISTRADOR: 'O sistema precisa de pelo menos um administrador ativo.',
  ALTERACAO_PROPRIA_NAO_PERMITIDA:
    'Você não pode desativar nem tirar o seu próprio acesso de administrador. Peça a outro administrador.',
  EMAIL_ACESSO_FALHOU:
    'Não conseguimos enviar o e-mail com a senha provisória. Tente de novo em alguns minutos.',
  SO_LOGIN_LOCAL: 'Esta opção é só para quem entra com login e senha.',
};

export const MENSAGEM_FALHA_REDE =
  'Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.';

export const MENSAGEM_SESSAO_EXPIRADA_NO_ENVIO =
  'Sua sessão expirou. Entre de novo e envie o arquivo outra vez.';
