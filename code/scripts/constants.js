export default {
  DOMAIN: "default",
  TABLES: {
    DIDS: "dids_table",
    GROUPS: "groups_table",
    USER_CREDENTIALS: "user_credentials_table",
    GROUPS_CREDENTIALS: "groups_credentials_table",
    IDENTITY: "identity_table",
    GROUP_DATABASES: "group_databases_table",
    USER_DATABASES: "user_databases_table",
  },
  CONTENT_TYPE: {
    CREDENTIAL: "credential",
    DATABASE: "db",
    GROUP_MEMBER: "group_member",
  },
  DB_KEY_SSI_PATH: "/dbKeySSI",
  SECURITY_CONTEXT_KEY_SSI_PATH: "security-context",
  IDENTITY_PK: "identity_pk",
  SHARED_ENCLAVE: "sharedEnclave",
  IDENTITY: "identity",
  RECIPIENT_TYPES: {
    USER_RECIPIENT: "user",
    GROUP_RECIPIENT: "group",
  },
  OPERATIONS: {
    REMOVE: "remove",
    ADD: "add",
  },
};
