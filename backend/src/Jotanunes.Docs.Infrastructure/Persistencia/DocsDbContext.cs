using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia;

public sealed class DocsDbContext(DbContextOptions<DocsDbContext> options) : DbContext(options)
{
    public const string IndiceCnpj = "ix_empresas_cnpj";
    public const string IndiceCodigoObra = "ix_obras_codigo_upper";
    public const string IndiceNomeTipo = "ix_tipos_documento_nome_lower";
    public const string IndiceEnvioVivo = "ix_envios_documento_vivo";
    public const string IndiceTokenConvite = "ix_convites_token_hash";

    public DbSet<Obra> Obras => Set<Obra>();
    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<ObraEmpresa> ObraEmpresas => Set<ObraEmpresa>();
    public DbSet<TipoDocumento> TiposDocumento => Set<TipoDocumento>();
    public DbSet<Convite> Convites => Set<Convite>();
    public DbSet<EnvioDocumento> Envios => Set<EnvioDocumento>();
    public DbSet<RegistroAuditoria> Auditoria => Set<RegistroAuditoria>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("unaccent");

        b.Entity<Obra>(e =>
        {
            e.ToTable("obras");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Nome).HasMaxLength(150).IsRequired();
            e.Property(x => x.Codigo).HasMaxLength(30);
            e.Property(x => x.Cidade).HasMaxLength(100).IsRequired();
            e.Property(x => x.Uf).HasConversion<string>().HasColumnType("char(2)").IsRequired();
            e.Property(x => x.CriadoPorLogin).HasMaxLength(100).IsRequired();
            e.Property(x => x.AtualizadoPorLogin).HasMaxLength(100);
            e.HasIndex(x => x.Nome);
            // índice único upper(codigo) WHERE codigo IS NOT NULL: criado por SQL na migration (IndiceCodigoObra)
        });

        b.Entity<Empresa>(e =>
        {
            e.ToTable("empresas");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Ignore(x => x.JaConvidada);
            e.Property(x => x.RazaoSocial).HasMaxLength(200).IsRequired();
            e.Property(x => x.NomeFantasia).HasMaxLength(200);
            e.Property(x => x.Cnpj).HasColumnType("char(14)").IsRequired();
            e.HasIndex(x => x.Cnpj).IsUnique().HasDatabaseName(IndiceCnpj);
            e.Property(x => x.EmailContato).HasMaxLength(254).IsRequired();
            e.Property(x => x.NomeContato).HasMaxLength(150);
            e.Property(x => x.Telefone).HasMaxLength(20);
            e.Property(x => x.SenhaHash).HasMaxLength(100);
            e.Property(x => x.CriadoPorLogin).HasMaxLength(100).IsRequired();
            e.Property(x => x.AtualizadoPorLogin).HasMaxLength(100);
            e.HasIndex(x => x.RazaoSocial);
        });

        b.Entity<ObraEmpresa>(e =>
        {
            e.ToTable("obra_empresas");
            e.HasKey(x => new { x.ObraId, x.EmpresaId });
            e.Property(x => x.VinculadoPorLogin).HasMaxLength(100).IsRequired();
            e.HasOne<Obra>().WithMany().HasForeignKey(x => x.ObraId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.EmpresaId);
        });

        b.Entity<TipoDocumento>(e =>
        {
            e.ToTable("tipos_documento");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            e.Property(x => x.Instrucoes).HasMaxLength(1000);
            e.Property(x => x.CriadoPorLogin).HasMaxLength(100).IsRequired();
            e.Property(x => x.AtualizadoPorLogin).HasMaxLength(100);
            // índice único lower(nome): criado por SQL na migration (IndiceNomeTipo)
        });

        b.Entity<Convite>(e =>
        {
            e.ToTable("convites");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.EmailDestino).HasMaxLength(254).IsRequired();
            e.Property(x => x.TokenHash).HasColumnType("char(64)").IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique().HasDatabaseName(IndiceTokenConvite);
            e.Property(x => x.EnviadoPorLogin).HasMaxLength(100).IsRequired();
            e.Property(x => x.EnviadoPorNome).HasMaxLength(150).IsRequired();
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.EmpresaId, x.EnviadoEm });
        });

        b.Entity<EnvioDocumento>(e =>
        {
            e.ToTable("envios_documento");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.NomeArquivo).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(50).IsRequired();
            e.Property(x => x.Sha256).HasColumnType("char(64)").IsRequired();
            e.Property(x => x.ChaveArmazenamento).HasMaxLength(300).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            e.Property(x => x.AnalisadoPorLogin).HasMaxLength(100);
            e.Property(x => x.AnalisadoPorNome).HasMaxLength(150);
            e.Property(x => x.MotivoRejeicao).HasMaxLength(500);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<TipoDocumento>().WithMany().HasForeignKey(x => x.TipoDocumentoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.EmpresaId, x.TipoDocumentoId, x.EnviadoEm })
                .IsDescending(false, false, true)
                .HasDatabaseName("ix_envios_documento_empresa_tipo_enviado");
            e.HasIndex(x => new { x.Status, x.EnviadoEm }).HasDatabaseName("ix_envios_documento_status_enviado");
            e.HasIndex(x => new { x.EmpresaId, x.TipoDocumentoId })
                .IsUnique()
                .HasFilter("status <> 'REJEITADO'")
                .HasDatabaseName(IndiceEnvioVivo);
        });

        b.Entity<RegistroAuditoria>(e =>
        {
            e.ToTable("auditoria");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.AtorTipo).HasMaxLength(10).IsRequired();
            e.Property(x => x.AtorId).HasMaxLength(100);
            e.Property(x => x.Acao).HasMaxLength(40).IsRequired();
            e.Property(x => x.RecursoTipo).HasMaxLength(40);
            e.Property(x => x.RecursoId).HasMaxLength(100);
            e.Property(x => x.Ip).HasMaxLength(45);
            e.HasIndex(x => x.OcorridoEm);
        });
    }
}
