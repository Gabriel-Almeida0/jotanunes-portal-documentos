CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE auditoria (
    id bigint GENERATED ALWAYS AS IDENTITY,
    ocorrido_em timestamp with time zone NOT NULL,
    ator_tipo character varying(10) NOT NULL,
    ator_id character varying(100),
    acao character varying(40) NOT NULL,
    recurso_tipo character varying(40),
    recurso_id character varying(100),
    ip character varying(45),
    CONSTRAINT pk_auditoria PRIMARY KEY (id)
);

CREATE TABLE empresas (
    id uuid NOT NULL,
    razao_social character varying(200) NOT NULL,
    nome_fantasia character varying(200),
    cnpj char(14) NOT NULL,
    email_contato character varying(254) NOT NULL,
    nome_contato character varying(150),
    telefone character varying(20),
    ativa boolean NOT NULL,
    senha_hash character varying(100),
    troca_senha_obrigatoria boolean NOT NULL,
    senha_temporaria_expira_em timestamp with time zone,
    versao_credencial integer NOT NULL,
    tentativas_falhas integer NOT NULL,
    bloqueado_ate timestamp with time zone,
    ultimo_acesso_em timestamp with time zone,
    criado_em timestamp with time zone NOT NULL,
    criado_por_login character varying(100) NOT NULL,
    atualizado_em timestamp with time zone,
    atualizado_por_login character varying(100),
    CONSTRAINT pk_empresas PRIMARY KEY (id)
);

CREATE TABLE obras (
    id uuid NOT NULL,
    nome character varying(150) NOT NULL,
    codigo character varying(30),
    cidade character varying(100) NOT NULL,
    uf char(2) NOT NULL,
    ativa boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    criado_por_login character varying(100) NOT NULL,
    atualizado_em timestamp with time zone,
    atualizado_por_login character varying(100),
    CONSTRAINT pk_obras PRIMARY KEY (id)
);

CREATE TABLE tipos_documento (
    id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    instrucoes character varying(1000),
    ativo boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    criado_por_login character varying(100) NOT NULL,
    atualizado_em timestamp with time zone,
    atualizado_por_login character varying(100),
    CONSTRAINT pk_tipos_documento PRIMARY KEY (id)
);

CREATE TABLE convites (
    id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    email_destino character varying(254) NOT NULL,
    token_hash char(64) NOT NULL,
    enviado_em timestamp with time zone NOT NULL,
    enviado_por_login character varying(100) NOT NULL,
    enviado_por_nome character varying(150) NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado_em timestamp with time zone,
    substituido_em timestamp with time zone,
    CONSTRAINT pk_convites PRIMARY KEY (id),
    CONSTRAINT fk_convites_empresas_empresa_id FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT
);

CREATE TABLE obra_empresas (
    obra_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    vinculado_em timestamp with time zone NOT NULL,
    vinculado_por_login character varying(100) NOT NULL,
    CONSTRAINT pk_obra_empresas PRIMARY KEY (obra_id, empresa_id),
    CONSTRAINT fk_obra_empresas_empresas_empresa_id FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,
    CONSTRAINT fk_obra_empresas_obras_obra_id FOREIGN KEY (obra_id) REFERENCES obras (id) ON DELETE RESTRICT
);

CREATE TABLE envios_documento (
    id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    tipo_documento_id uuid NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    content_type character varying(50) NOT NULL,
    tamanho_bytes bigint NOT NULL,
    sha256 char(64) NOT NULL,
    chave_armazenamento character varying(300) NOT NULL,
    enviado_em timestamp with time zone NOT NULL,
    status character varying(20) NOT NULL,
    analisado_em timestamp with time zone,
    analisado_por_login character varying(100),
    analisado_por_nome character varying(150),
    motivo_rejeicao character varying(500),
    CONSTRAINT pk_envios_documento PRIMARY KEY (id),
    CONSTRAINT fk_envios_documento_empresas_empresa_id FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envios_documento_tipos_documento_tipo_documento_id FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id) ON DELETE RESTRICT
);

CREATE INDEX ix_auditoria_ocorrido_em ON auditoria (ocorrido_em);

CREATE INDEX ix_convites_empresa_id_enviado_em ON convites (empresa_id, enviado_em);

CREATE UNIQUE INDEX ix_convites_token_hash ON convites (token_hash);

CREATE UNIQUE INDEX ix_empresas_cnpj ON empresas (cnpj);

CREATE INDEX ix_empresas_razao_social ON empresas (razao_social);

CREATE INDEX ix_envios_documento_empresa_tipo_enviado ON envios_documento (empresa_id, tipo_documento_id, enviado_em DESC);

CREATE INDEX ix_envios_documento_status_enviado ON envios_documento (status, enviado_em);

CREATE INDEX ix_envios_documento_tipo_documento_id ON envios_documento (tipo_documento_id);

CREATE UNIQUE INDEX ix_envios_documento_vivo ON envios_documento (empresa_id, tipo_documento_id) WHERE status <> 'REJEITADO';

CREATE INDEX ix_obra_empresas_empresa_id ON obra_empresas (empresa_id);

CREATE INDEX ix_obras_nome ON obras (nome);

CREATE UNIQUE INDEX ix_obras_codigo_upper ON obras (upper(codigo)) WHERE codigo IS NOT NULL;

CREATE UNIQUE INDEX ix_tipos_documento_nome_lower ON tipos_documento (lower(nome));

INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
VALUES ('20260929031207_Inicial', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE tentativas_login (
    chave char(64) NOT NULL,
    tentativas_falhas integer NOT NULL,
    bloqueado_ate timestamp with time zone,
    ultima_falha_em timestamp with time zone,
    CONSTRAINT pk_tentativas_login PRIMARY KEY (chave)
);

INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
VALUES ('20260929040722_TentativasLoginPorCnpj', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE auditoria ADD ator_admin boolean;

INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
VALUES ('20260929144808_PerfilAdminAuditoria', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE usuarios_internos (
    id uuid NOT NULL,
    login character varying(100) NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(254) NOT NULL,
    admin boolean NOT NULL,
    ativo boolean NOT NULL,
    senha_hash character varying(100) NOT NULL,
    troca_senha_obrigatoria boolean NOT NULL,
    senha_provisoria_expira_em timestamp with time zone,
    versao_credencial integer NOT NULL,
    tentativas_falhas integer NOT NULL,
    bloqueado_ate timestamp with time zone,
    ultimo_acesso_em timestamp with time zone,
    criado_em timestamp with time zone NOT NULL,
    criado_por_login character varying(100) NOT NULL,
    atualizado_em timestamp with time zone,
    atualizado_por_login character varying(100),
    CONSTRAINT pk_usuarios_internos PRIMARY KEY (id)
);

CREATE INDEX ix_usuarios_internos_admin_ativo ON usuarios_internos (admin, ativo) WHERE admin AND ativo;

CREATE INDEX ix_usuarios_internos_nome ON usuarios_internos (nome);

CREATE UNIQUE INDEX ix_usuarios_internos_login_lower ON usuarios_internos (lower(login));

INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
VALUES ('20260929171118_UsuariosInternos', '8.0.11');

COMMIT;

