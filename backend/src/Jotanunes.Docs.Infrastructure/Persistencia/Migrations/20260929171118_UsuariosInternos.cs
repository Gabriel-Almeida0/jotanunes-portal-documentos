using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jotanunes.Docs.Infrastructure.Persistencia.Migrations
{
    /// <inheritdoc />
    public partial class UsuariosInternos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "usuarios_internos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    admin = table.Column<bool>(type: "boolean", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false),
                    senha_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    troca_senha_obrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    senha_provisoria_expira_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("pk_usuarios_internos", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_internos_admin_ativo",
                table: "usuarios_internos",
                columns: new[] { "admin", "ativo" },
                filter: "admin AND ativo");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_internos_nome",
                table: "usuarios_internos",
                column: "nome");

            // Login único sem diferenciar maiúsculas (data-model §10); violação → LOGIN_DUPLICADO.
            migrationBuilder.Sql($"CREATE UNIQUE INDEX {DocsDbContext.IndiceLoginUsuario} ON usuarios_internos (lower(login));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "usuarios_internos");
        }
    }
}
