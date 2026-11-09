using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jotanunes.Docs.Infrastructure.Persistencia.Migrations
{
    /// <inheritdoc />
    public partial class DocumentosPeriodicos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento");

            // Início da cobrança dos tipos existentes = criação (003 data-model §1): coluna nula, preenchida, depois NOT NULL.
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "cobranca_desde",
                table: "tipos_documento",
                type: "timestamp with time zone",
                nullable: true);
            migrationBuilder.Sql("UPDATE tipos_documento SET cobranca_desde = criado_em;");
            migrationBuilder.Sql("ALTER TABLE tipos_documento ALTER COLUMN cobranca_desde SET NOT NULL;");

            migrationBuilder.AddColumn<int>(
                name: "periodicidade_intervalo",
                table: "tipos_documento",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "periodicidade_unidade",
                table: "tipos_documento",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValueSql: "'UNICA'");

            migrationBuilder.AddColumn<int>(
                name: "prazo_dias",
                table: "tipos_documento",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "enviado_com_atraso",
                table: "envios_documento",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "periodo_fim",
                table: "envios_documento",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "periodo_inicio",
                table: "envios_documento",
                type: "date",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_tipos_documento_periodicidade",
                table: "tipos_documento",
                sql: "(periodicidade_unidade = 'UNICA' AND periodicidade_intervalo IS NULL AND prazo_dias IS NULL) OR (periodicidade_unidade = 'MESES' AND periodicidade_intervalo BETWEEN 1 AND 24 AND prazo_dias BETWEEN 0 AND 90) OR (periodicidade_unidade = 'DIAS' AND periodicidade_intervalo BETWEEN 1 AND 365 AND prazo_dias BETWEEN 0 AND 90)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tipos_documento_periodicidade_unidade",
                table: "tipos_documento",
                sql: "periodicidade_unidade IN ('UNICA', 'MESES', 'DIAS')");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_periodo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id", "obra_id", "periodo_inicio", "enviado_em" },
                descending: new[] { false, false, false, false, true },
                filter: "periodo_inicio IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id", "obra_id", "periodo_inicio" },
                unique: true,
                filter: "status <> 'REJEITADO'")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddCheckConstraint(
                name: "ck_envios_documento_periodo",
                table: "envios_documento",
                sql: "(periodo_inicio IS NULL AND periodo_fim IS NULL) OR (periodo_inicio IS NOT NULL AND periodo_fim >= periodo_inicio)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_tipos_documento_periodicidade",
                table: "tipos_documento");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tipos_documento_periodicidade_unidade",
                table: "tipos_documento");

            migrationBuilder.DropIndex(
                name: "ix_envios_documento_periodo",
                table: "envios_documento");

            migrationBuilder.DropIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento");

            migrationBuilder.DropCheckConstraint(
                name: "ck_envios_documento_periodo",
                table: "envios_documento");

            migrationBuilder.DropColumn(
                name: "cobranca_desde",
                table: "tipos_documento");

            migrationBuilder.DropColumn(
                name: "periodicidade_intervalo",
                table: "tipos_documento");

            migrationBuilder.DropColumn(
                name: "periodicidade_unidade",
                table: "tipos_documento");

            migrationBuilder.DropColumn(
                name: "prazo_dias",
                table: "tipos_documento");

            migrationBuilder.DropColumn(
                name: "enviado_com_atraso",
                table: "envios_documento");

            migrationBuilder.DropColumn(
                name: "periodo_fim",
                table: "envios_documento");

            migrationBuilder.DropColumn(
                name: "periodo_inicio",
                table: "envios_documento");

            migrationBuilder.CreateIndex(
                name: "ix_envios_documento_vivo",
                table: "envios_documento",
                columns: new[] { "empresa_id", "tipo_documento_id", "obra_id" },
                unique: true,
                filter: "status <> 'REJEITADO'")
                .Annotation("Npgsql:NullsDistinct", false);
        }
    }
}
