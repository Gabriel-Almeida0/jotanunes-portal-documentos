import { Campo } from './Campo';
import type { useFormularioEmpresa } from '../hooks/useFormularioEmpresa';

export function CamposEmpresa({
  form,
  cnpjBloqueado = false,
}: {
  form: ReturnType<typeof useFormularioEmpresa>;
  cnpjBloqueado?: boolean;
}) {
  const { valores, erros, alterar } = form;
  return (
    <>
      <Campo
        className="jn-grade-form__inteiro"
        rotulo="Razão social"
        obrigatorio
        maxLength={200}
        value={valores.razaoSocial}
        onChange={(e) => alterar('razaoSocial', e.target.value)}
        erro={erros.razaoSocial}
        autoComplete="organization"
      />
      <Campo
        rotulo="Nome fantasia"
        maxLength={200}
        value={valores.nomeFantasia}
        onChange={(e) => alterar('nomeFantasia', e.target.value)}
        erro={erros.nomeFantasia}
      />
      <Campo
        rotulo="CNPJ"
        obrigatorio
        inputMode="text"
        autoCapitalize="characters"
        placeholder="00.000.000/0000-00"
        maxLength={18}
        value={valores.cnpj}
        onChange={(e) => alterar('cnpj', e.target.value)}
        erro={erros.cnpj}
        readOnly={cnpjBloqueado}
        aria-readonly={cnpjBloqueado || undefined}
        ajuda={
          cnpjBloqueado
            ? 'O CNPJ não pode ser alterado depois do convite.'
            : 'Aceita o formato numérico e o novo alfanumérico da Receita.'
        }
      />
      <Campo
        rotulo="E-mail de contato"
        obrigatorio
        type="email"
        maxLength={254}
        value={valores.emailContato}
        onChange={(e) => alterar('emailContato', e.target.value)}
        erro={erros.emailContato}
        ajuda="O convite para o portal vai para este e-mail."
        autoComplete="email"
      />
      <Campo
        rotulo="Nome do contato"
        maxLength={150}
        value={valores.nomeContato}
        onChange={(e) => alterar('nomeContato', e.target.value)}
        erro={erros.nomeContato}
        autoComplete="name"
      />
      <Campo
        rotulo="Telefone"
        type="tel"
        inputMode="tel"
        maxLength={20}
        placeholder="(79) 99999-9999"
        value={valores.telefone}
        onChange={(e) => alterar('telefone', e.target.value)}
        erro={erros.telefone}
        autoComplete="tel"
      />
    </>
  );
}
