using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jotanunes.Docs.Infrastructure.Persistencia.Migrations
{
    /// <inheritdoc />
    public partial class DocumentosPorObra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento");

            migrationBuilder.AddColumn<string>(
                name: "abrangencia",
                table: "tipos_documento",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValueSql: "'GERAL'");

            migrationBuilder.AddColumn<bool>(
                name: "ativo",
                table: "obra_empresas",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "encerrado_em",
                table: "obra_empresas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "encerrado_por_login",
                table: "obra_empresas",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "obra_id",
                table: "envios_documento",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "obra_tipos_documento",
                columns: table => new
                {
                    obra_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo_documento_id = table.Column<Guid>(type: "uuid", nullable: false),
                    marcado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    marcado_por_login = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_obra_tipos_documento", x => new { x.obra_id, x.tipo_documento_id });
                    table.ForeignKey(
                        name: "fk_obra_tipos_documento_obras_obra_id",
                        column: x => x.obra_id,
                        principalTable: "obras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_obra_tipos_documento_tipos_documento_tipo_documento_id",
                        column: x => x.tipo_documento_id,
                        principalTable: "tipos_documento",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_tipos_documento_abrangencia",
                table: "tipos_documento",
                sql: "abrangencia IN ('GERAL', 'POR_OBRA')");

            migrationBuilder.CreateIndex(
                name: "ix_obra_empresas_empresa_ativo",
                table: "obra_empresas",
                column: "empresa_id",
                filter: "ativo");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_obra_empresa_tipo_enviado",
                table: "envios_documento",
                columns: new[] { "obra_id", "empresa_id", "tipo_documento_id", "enviado_em" },
                descending: new[] { false, false, false, true },
                filter: "obra_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id", "obra_id" },
                unique: true,
                filter: "status <> 'REJEITADO'")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_obra_tipos_documento_tipo_documento_id",
                table: "obra_tipos_documento",
                column: "tipo_documento_id");

            migrationBuilder.AddForeignKey(
                name: "fk_envios_documento_obras_obra_id",
                table: "envios_documento",
                column: "obra_id",
                principalTable: "obras",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_envios_documento_obras_obra_id",
                table: "envios_documento");

            migrationBuilder.DropTable(
                name: "obra_tipos_documento");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tipos_documento_abrangencia",
                table: "tipos_documento");

            migrationBuilder.DropIndex(
                name: "ix_obra_empresas_empresa_ativo",
                table: "obra_empresas");

            migrationBuilder.DropIndex(
                name: "ix_envios_documento_obra_empresa_tipo_enviado",
                table: "envios_documento");

            migrationBuilder.DropIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento");

            migrationBuilder.DropColumn(
                name: "abrangencia",
                table: "tipos_documento");

            migrationBuilder.DropColumn(
                name: "ativo",
                table: "obra_empresas");

            migrationBuilder.DropColumn(
                name: "encerrado_em",
                table: "obra_empresas");

            migrationBuilder.DropColumn(
                name: "encerrado_por_login",
                table: "obra_empresas");

            migrationBuilder.DropColumn(
                name: "obra_id",
                table: "envios_documento");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id" },
                unique: true,
                filter: "status <> 'REJEITADO'");
        }
    }
}
