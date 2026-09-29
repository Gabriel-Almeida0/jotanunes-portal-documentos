using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Application.TiposDocumento;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Jotanunes.Docs.Application.Tests.TiposDocumento;

/// <summary>Catálogo padrão de tipos de documento (data-model §4.1, research R15; FR-090, FR-091, FR-093).</summary>
public class CatalogoTiposPadraoTests
{
    /// <summary>Cópia literal da tabela de data-model.md §4.1 (fonte do texto).</summary>
    private static readonly (string Nome, string Instrucoes)[] Esperado =
    [
        ("Cartão CNPJ", "Envie o comprovante de inscrição e situação cadastral do CNPJ, emitido no site da Receita Federal, com data de emissão recente."),
        ("Contrato Social e última alteração", "Envie o contrato social e a última alteração contratual (ou a consolidação), com o registro na Junta Comercial."),
        ("CND Federal (Receita Federal/PGFN)", "Envie a certidão de débitos relativos a tributos federais e à dívida ativa da União, emitida no site da Receita Federal e dentro da validade."),
        ("CND Estadual", "Envie a certidão negativa de débitos estaduais, emitida pela Secretaria da Fazenda do estado da sede da empresa e dentro da validade."),
        ("CND Municipal", "Envie a certidão negativa de débitos municipais, emitida pela prefeitura da cidade da sede da empresa e dentro da validade."),
        ("CRF do FGTS", "Envie o Certificado de Regularidade do FGTS (CRF), emitido no site da Caixa e dentro da validade."),
        ("CNDT (Certidão Negativa de Débitos Trabalhistas)", "Envie a CNDT emitida no site do Tribunal Superior do Trabalho (TST), dentro da validade."),
        ("PGR (Programa de Gerenciamento de Riscos)", "Envie o PGR vigente da empresa, com o inventário de riscos e o plano de ação, assinado pelo responsável."),
        ("PCMSO (Programa de Controle Médico de Saúde Ocupacional)", "Envie o PCMSO vigente, assinado pelo médico do trabalho responsável."),
        ("ART/RRT", "Envie a ART (CREA) ou o RRT (CAU) do responsável técnico pelos serviços contratados, com o comprovante de pagamento."),
    ];

    private static readonly DateTimeOffset Agora = new(2026, 9, 29, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Catalogo_tem_os_10_tipos_de_data_model_na_ordem()
    {
        Assert.Equal(Esperado, CatalogoTiposPadrao.Itens.Select(t => (t.Nome, t.Instrucoes)).ToArray());
    }

    [Fact]
    public void Nomes_sao_unicos_sem_diferenciar_maiusculas()
    {
        Assert.Equal(10, CatalogoTiposPadrao.Itens.Select(t => t.Nome.ToLowerInvariant()).Distinct().Count());
    }

    [Fact]
    public void Todos_sao_aceitos_pelo_dominio()
    {
        Assert.All(CatalogoTiposPadrao.Itens, item =>
        {
            Assert.InRange(item.Nome.Length, 3, 120);
            Assert.False(string.IsNullOrWhiteSpace(item.Instrucoes));
            Assert.InRange(item.Instrucoes.Length, 1, 1000);
            var t = TipoDocumento.Criar(item.Nome, item.Instrucoes, "sistema", Agora);
            Assert.Equal(item.Nome, t.Nome);
            Assert.Equal(item.Instrucoes, t.Instrucoes);
        });
    }

    [Fact]
    public async Task Repositorio_vazio_cria_10_tipos_ativos_com_autor_sistema_em_um_unico_salvamento()
    {
        var f = new Fakes();
        var criados = await f.Semeador().ExecutarAsync();

        Assert.Equal(10, criados);
        Assert.Equal(Esperado.Select(e => e.Nome), f.Repositorio.Salvos.Select(t => t.Nome));
        Assert.All(f.Repositorio.Salvos, t =>
        {
            Assert.True(t.Ativo);
            Assert.Equal("sistema", t.CriadoPorLogin);
            Assert.Equal(Agora, t.CriadoEm);
        });
        Assert.Equal(1, f.Uow.Salvamentos);
        Assert.Equal(1, f.Uow.Confirmacoes);
        Assert.Equal([SemearCatalogoTiposPadrao.ChaveBloqueio], f.Bloqueio.Chaves);
        Assert.True(f.Bloqueio.DentroDaTransacao);
    }

    [Fact]
    public async Task Com_um_tipo_inativo_existente_nao_cria_nada()
    {
        var f = new Fakes();
        var existente = TipoDocumento.Criar("Tipo antigo", null, "maria", Agora);
        existente.Atualizar("Tipo antigo", null, false, "maria", Agora);
        f.Repositorio.Salvos.Add(existente);

        Assert.Equal(0, await f.Semeador().ExecutarAsync());

        Assert.Single(f.Repositorio.Salvos);
        Assert.False(f.Repositorio.Salvos[0].Ativo);
        Assert.Equal(0, f.Uow.Salvamentos);
        Assert.Equal(0, f.Uow.Confirmacoes);
    }

    [Fact]
    public async Task Chamado_duas_vezes_cria_so_na_primeira()
    {
        var f = new Fakes();
        Assert.Equal(10, await f.Semeador().ExecutarAsync());
        Assert.Equal(0, await f.Semeador().ExecutarAsync());
        Assert.Equal(10, f.Repositorio.Salvos.Count);
    }

    [Fact]
    public async Task Nome_duplicado_na_corrida_nao_derruba_a_inicializacao()
    {
        var f = new Fakes();
        f.Uow.ErroAoSalvar = new ErroAplicacao(CodigoErro.NOME_DUPLICADO);

        Assert.Equal(0, await f.Semeador().ExecutarAsync());
        Assert.Equal(0, f.Uow.Confirmacoes);
    }

    [Fact]
    public async Task Outro_erro_ao_salvar_nao_e_engolido()
    {
        var f = new Fakes();
        f.Uow.ErroAoSalvar = new ErroAplicacao(CodigoErro.ERRO_INTERNO);

        await Assert.ThrowsAsync<ErroAplicacao>(() => f.Semeador().ExecutarAsync());
    }

    private sealed class Fakes
    {
        public RepositorioFake Repositorio { get; } = new();
        public UnidadeTrabalhoFake Uow { get; }
        public BloqueioFake Bloqueio { get; }

        public Fakes()
        {
            Uow = new UnidadeTrabalhoFake(Repositorio);
            Bloqueio = new BloqueioFake(Uow);
        }

        public SemearCatalogoTiposPadrao Semeador() =>
            new(Repositorio, Uow, Bloqueio, new FakeTimeProvider(Agora), NullLogger<SemearCatalogoTiposPadrao>.Instance);
    }

    private sealed class RepositorioFake : ITipoDocumentoRepositorio
    {
        public List<TipoDocumento> Salvos { get; } = [];
        public List<TipoDocumento> Pendentes { get; } = [];

        public Task<TipoDocumento?> ObterAsync(Guid id, CancellationToken ct = default) => Task.FromResult(Salvos.FirstOrDefault(t => t.Id == id));

        public void Adicionar(TipoDocumento tipo) => Pendentes.Add(tipo);

        public Task<IReadOnlyList<TipoDocumento>> ListarAsync(bool? ativo, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<TipoDocumento>>(Salvos.Where(t => ativo is null || t.Ativo == ativo).ToList());

        public Task<bool> ExisteAlgumAsync(CancellationToken ct = default) => Task.FromResult(Salvos.Count > 0);
    }

    private sealed class UnidadeTrabalhoFake(RepositorioFake repositorio) : IUnidadeTrabalho
    {
        public int Salvamentos { get; private set; }
        public int Confirmacoes { get; private set; }
        public bool TransacaoAberta { get; private set; }
        public ErroAplicacao? ErroAoSalvar { get; set; }

        public Task SalvarAsync(CancellationToken ct = default)
        {
            if (ErroAoSalvar is not null) throw ErroAoSalvar;
            Salvamentos++;
            repositorio.Salvos.AddRange(repositorio.Pendentes);
            repositorio.Pendentes.Clear();
            return Task.CompletedTask;
        }

        public Task<ITransacao> IniciarTransacaoAsync(CancellationToken ct = default)
        {
            TransacaoAberta = true;
            return Task.FromResult<ITransacao>(new Transacao(this));
        }

        private sealed class Transacao(UnidadeTrabalhoFake dono) : ITransacao
        {
            public Task ConfirmarAsync(CancellationToken ct = default)
            {
                dono.Confirmacoes++;
                dono.TransacaoAberta = false;
                return Task.CompletedTask;
            }

            public Task DesfazerAsync(CancellationToken ct = default)
            {
                dono.TransacaoAberta = false;
                return Task.CompletedTask;
            }

            public ValueTask DisposeAsync()
            {
                dono.TransacaoAberta = false;
                return ValueTask.CompletedTask;
            }
        }
    }

    private sealed class BloqueioFake(UnidadeTrabalhoFake uow) : IBloqueioExclusivo
    {
        public List<long> Chaves { get; } = [];
        public bool DentroDaTransacao { get; private set; } = true;

        public Task AdquirirAsync(long chave, CancellationToken ct = default)
        {
            Chaves.Add(chave);
            DentroDaTransacao &= uow.TransacaoAberta;
            return Task.CompletedTask;
        }
    }
}
