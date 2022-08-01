export default {
  DOMAIN: "default",
  TABLES: {
    DIDS: "dids_table",
    GROUPS: "groups_table",
    USER_CREDENTIALS: "user_credentials_table",
    GROUPS_CREDENTIALS: "groups_credentials_table",
    IDENTITY: "identity_table",
    GROUP_ENCLAVES: "group_databases_table",
    USER_DATABASES: "user_databases_table",
    LOGS_TABLE: "demiurge_logs_table"
  },
  CONTENT_TYPE: {
    CREDENTIAL: "credential",
    DATABASE: "db",
    GROUP_MEMBER: "group_member",
  },
  DB_KEY_SSI_PATH: "/dbKeySSI",
  SECURITY_CONTEXT_KEY_SSI_PATH: "security-context",
  IDENTITY_PK: "identity_pk",
  SHARED_ENCLAVE: "demiurgeSharedEnclave",
  EPI_SHARED_ENCLAVE: "epiEnclave",
  IDENTITY: "identity",
  EPI_ADMIN_GROUP: "ePI_Administration_Group",
  EPI_WRITE_GROUP: "ePI_Write_Group",
  EPI_READ_GROUP: "ePI_Read_Group",
  RECIPIENT_TYPES: {
    USER_RECIPIENT: "user",
    GROUP_RECIPIENT: "group",
  },
  OPERATIONS: {
    REMOVE: "remove",
    ADD: "add",
    DEACTIVATE: "deactivate"
  },
  APP_NAMES_MAP: {
    "ePI Administration Group": "Demiurge",
    "ePI Write Group": "DSU_Fabric",
    "ePI Read Group": "DSU_Fabric"
  }
};
