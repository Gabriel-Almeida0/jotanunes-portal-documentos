/**
 * Perfil comum (US6, FR-082, FR-084): consulta tudo, envia convites, e não vê nenhuma ação de
 * administrador — elas somem (não ficam desabilitadas) e cada tela explica uma vez por quê.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { api } from '../api/fluig';
import { IDS, definirPerfilMock } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

const AVISO = 'Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.';

/** Nomes (acessíveis) de todo controle de administrador. */
const ACOES_ADMIN = [
  /Novo tipo/i,
  /Nova obra/i,
  /Nova empresa/i,
  /Editar/i,
  /Salvar/i,
  /ativar/i, // "Ativar" e "Desativar"
  /Vincular empresa/i,
  /Desvincular/i,
  /Aprovar/i,
  /Rejeitar/i,
  /Descartar alterações/i,
];

function semAcoesDeAdmin() {
  for (const nome of ACOES_ADMIN) {
    expect(screen.queryAllByRole('button', { name: nome }), `botão ${nome}`).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: nome }), `link ${nome}`).toHaveLength(0);
  }
}

function avisoUmaVez() {
  const notas = screen.getAllByRole('note');
  expect(notas).toHaveLength(1);
  expect(notas[0]).toHaveTextContent(AVISO);
}

describe('Perfil comum', () => {
  beforeEach(() => definirPerfilMock('comum'));

  it('Painel: mostra os indicadores e o aviso', async () => {
    renderizarRota('/');
    expect(await screen.findByText(/aguardando análise/)).toBeInTheDocument();
    expect(screen.getByText(/Olá, João!/)).toBeInTheDocument();
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Obras: lista as obras sem "Nova obra"', async () => {
    renderizarRota('/obras');
    const tabela = await screen.findByRole('table', { name: 'Obras' });
    expect(within(tabela).getByText('Residencial Vista do Rio')).toBeInTheDocument();
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Obra: mostra os dados e as empresas sem editar, ativar/desativar, vincular ou desvincular', async () => {
    renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' });
    expect(screen.getByText('Código VDR-01')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    expect(within(tabela).getByText('Alfa Engenharia Ltda')).toBeInTheDocument();
    expect(within(tabela).getAllByRole('link', { name: /Ver empresa/ }).length).toBeGreaterThan(0);
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Empresas: lista as empresas sem "Nova empresa"', async () => {
    renderizarRota('/empresas');
    const tabela = await screen.findByRole('table', { name: 'Empresas' });
    expect(within(tabela).getByText('Alfa Engenharia Ltda')).toBeInTheDocument();
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Empresa: dados em modo leitura, documentos e histórico, sem editar nem ativar/desativar', async () => {
    renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    const dados = screen.getByRole('region', { name: 'Dados da empresa' });
    expect(within(dados).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dados).getByText('Razão social')).toBeInTheDocument();
    expect(within(dados).getByText('contato@alfa.test')).toBeInTheDocument();
    expect(within(dados).getByText('Carlos Menezes')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: /Documentos/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Histórico de/ }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('link', { name: /^Analisar/ })).toHaveLength(0);
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Empresa: "Enviar convite" continua funcionando e muda o selo para "Convidada"', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });
    const secao = () => screen.getByRole('region', { name: 'Acesso ao portal' });
    await usuario.click(within(secao()).getByRole('button', { name: 'Enviar convite' }));
    const dialogo = screen.queryByRole('dialog');
    if (dialogo) await usuario.click(within(dialogo).getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(within(secao()).getAllByText('Convidada').length).toBeGreaterThan(0));
    expect(within(secao()).getByText(/Convite enviado para financeiro@gama.test/)).toBeInTheDocument();
  });

  it('Tipos de documento: lista os tipos sem novo, editar ou ativar/desativar', async () => {
    renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getByText('Cartão CNPJ')).toBeInTheDocument();
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Fila de análise: mostra os envios com o link "Ver" (mesma rota)', async () => {
    renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: /envios|Fila/i });
    const links = within(tabela).getAllByRole('link', { name: /^Ver / });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/analise\//));
    expect(within(tabela).queryAllByRole('link', { name: /^Analisar/ })).toHaveLength(0);
    avisoUmaVez();
    semAcoesDeAdmin();
  });

  it('Análise do envio: mostra os dados e "Abrir arquivo" sem aprovar/rejeitar', async () => {
    const abrir = vi.spyOn(api, 'abrirArquivoEnvio').mockResolvedValue(undefined);
    const { usuario } = renderizarRota(`/analise/${IDS.envioAlfaPcmso}`);
    await screen.findByRole('heading', { level: 1, name: 'PCMSO' });
    expect(screen.getByText('PCMSO 2026 - Alfa Engenharia.pdf')).toBeInTheDocument();
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
    avisoUmaVez();
    semAcoesDeAdmin();
    await usuario.click(screen.getByRole('button', { name: 'Abrir arquivo' }));
    expect(abrir).toHaveBeenCalledWith(IDS.envioAlfaPcmso);
  });
});

describe('Perfil administrador (padrão)', () => {
  it.each([
    ['/tipos-documento', /Novo tipo de documento/],
    ['/obras', /Nova obra/],
    ['/empresas', /Nova empresa/],
    [`/obras/${IDS.obraVistaDoRio}`, /Vincular empresa/],
    [`/empresas/${IDS.empresaAlfa}`, /Salvar alterações/],
    [`/analise/${IDS.envioAlfaPcmso}`, /^Aprovar$/],
  ])('%s: sem aviso e com as ações', async (rota, acao) => {
    renderizarRota(rota);
    expect((await screen.findAllByRole('button', { name: acao }))[0]).toBeEnabled();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('Fila de análise: link "Analisar"', async () => {
    renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: /envios|Fila/i });
    expect(within(tabela).getAllByRole('link', { name: /^Analisar/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
