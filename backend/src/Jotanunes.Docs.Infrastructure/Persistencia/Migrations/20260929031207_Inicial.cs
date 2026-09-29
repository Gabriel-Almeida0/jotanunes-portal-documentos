using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Jotanunes.Docs.Infrastructure.Persistencia.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,");

            migrationBuilder.CreateTable(
                name: "auditoria",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    ocorrido_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ator_tipo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ator_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    acao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    recurso_tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    recurso_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auditoria", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "empresas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    razao_social = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    nome_fantasia = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    cnpj = table.Column<string>(type: "char(14)", nullable: false),
                    email_contato = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    nome_contato = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    telefone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ativa = table.Column<bool>(type: "boolean", nullable: false),
                    senha_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    troca_senha_obrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    senha_temporaria_expira_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    versao_credencial = table.Column<int>(type: "integer", nullable: false),
                    tentativas_falhas = table.Column<int>(type: "integer", nullable: false),
                    bloqueado_ate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ultimo_acesso_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    criado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    atualizado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_empresas", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "obras",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    codigo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    cidade = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    uf = table.Column<string>(type: "char(2)", nullable: false),
                    ativa = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    criado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    atualizado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_obras", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tipos_documento",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    instrucoes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ativo = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    criado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    atualizado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tipos_documento", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "convites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email_destino = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    token_hash = table.Column<string>(type: "char(64)", nullable: false),
                    enviado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    enviado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    enviado_por_nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    expira_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    usado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    substituido_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_convites", x => x.id);
                    table.ForeignKey(
                        name: "fk_convites_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "obra_empresas",
                columns: table => new
                {
                    obra_id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vinculado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    vinculado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_obra_empresas", x => new { x.obra_id, x.empresa_id });
                    table.ForeignKey(
                        name: "fk_obra_empresas_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_obra_empresas_obras_obra_id",
                        column: x => x.obra_id,
                        principalTable: "obras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "envios_documento",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo_documento_id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome_arquivo = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    tamanho_bytes = table.Column<long>(type: "bigint", nullable: false),
                    sha256 = table.Column<string>(type: "char(64)", nullable: false),
                    chave_armazenamento = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    enviado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    analisado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    analisado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    analisado_por_nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    motivo_rejeicao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_envios_documento", x => x.id);
                    table.ForeignKey(
                        name: "fk_envios_documento_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_envios_documento_tipos_documento_tipo_documento_id",
                        column: x => x.tipo_documento_id,
                        principalTable: "tipos_documento",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_ocorrido_em",
                table: "auditoria",
                column: "ocorrido_em");

            migrationBuilder.CreateIndex(
                name: "ix_convites_empresa_id_enviado_em",
                table: "convites",
                columns: new[] { "empresa_id", "enviado_em" });

            migrationBuilder.CreateIndex(
                name: "ix_convites_token_hash",
                table: "convites",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_empresas_cnpj",
                table: "empresas",
                column: "cnpj",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_empresas_razao_social",
                table: "empresas",
                column: "razao_social");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_empresa_tipo_enviado",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id", "enviado_em" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_status_enviado",
                table: "envios_documento",
                columns: new[] { "status", "enviado_em" });

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_tipo_documento_id",
                table: "envios_documento",
                column: "tipo_documento_id");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id" },
                unique: true,
                filter: "status <> 'REJEITADO'");

            migrationBuilder.CreateIndex(
                name: "ix_obra_empresas_empresa_id",
                table: "obra_empresas",
                column: "empresa_id");

            migrationBuilder.CreateIndex(
                name: "ix_obras_nome",
                table: "obras",
                column: "nome");

            // Índices únicos case-insensitive (expressões não suportadas por HasIndex).
            migrationBuilder.Sql("CREATE UNIQUE INDEX ix_obras_codigo_upper ON obras (upper(codigo)) WHERE codigo IS NOT NULL;");
            migrationBuilder.Sql("CREATE UNIQUE INDEX ix_tipos_documento_nome_lower ON tipos_documento (lower(nome));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auditoria");

            migrationBuilder.DropTable(
                name: "convites");

            migrationBuilder.DropTable(
                name: "envios_documento");

            migrationBuilder.DropTable(
                name: "obra_empresas");

            migrationBuilder.DropTable(
                name: "tipos_documento");

            migrationBuilder.DropTable(
                name: "empresas");

            migrationBuilder.DropTable(
                name: "obras");
        }
    }
}
