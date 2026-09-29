using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jotanunes.Docs.Infrastructure.Persistencia.Migrations
{
    /// <inheritdoc />
    public partial class PerfilAdminAuditoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ator_admin",
                table: "auditoria",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ator_admin",
                table: "auditoria");
        }
    }
}
