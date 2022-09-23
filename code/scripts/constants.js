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
    LOGS_TABLE: "demiurge_logs_table",
    GOVERNANCE_CREDENTIALS: "governance_credentials"
  },
  CONTENT_TYPE: {
    CREDENTIAL: "credential",
    DATABASE: "db",
    GROUP_MEMBER: "group_member"
  },
  DB_KEY_SSI_PATH: "/dbKeySSI",
  SECURITY_CONTEXT_KEY_SSI_PATH: "security-context",
  IDENTITY_PK: "identity_pk",
  IDENTITY: "identity",
  RECIPIENT_TYPES: {
    USER_RECIPIENT: "user",
    GROUP_RECIPIENT: "group"
  },
  OPERATIONS: {
    REMOVE: "remove",
    ADD: "add",
    DEACTIVATE: "deactivate",
    LOGIN: "login"
  },
  SHARED_ENCLAVE: "demiurgeSharedEnclave",
  ADMIN_ACCESS_MODE: "admin",
  WRITE_ACCESS_MODE: "write",
  READ_ONLY_ACCESS_MODE: "read",
  // TODO: Implement backward compatibility for ePI
  EPI_GROUP_TAGS: [{
    name: "ePI Administration Group",
    tags: "Demiurge",
    enclaveName: "demiurgeSharedEnclave",
    accessMode: "admin"
  }, {
    name: "ePI Read Group",
    tags: "DSU_Fabric",
    enclaveName: "epiEnclave",
    accessMode: "read"
  }, {
    name: "ePI Write Group",
    tags: "DSU_Fabric",
    enclaveName: "epiEnclave",
    accessMode: "write"
  }],
  EPI_ADMIN_GROUP: "ePI_Administration_Group",
  // EPI_WRITE_GROUP: "ePI_Write_Group",
  EPI_READ_GROUP: "ePI_Read_Group",
  EPI_SHARED_ENCLAVE: "epiEnclave",

  JWT_ENCODING: "JWT_ENCODING",
  GS1_ENCODING: "GS1_ENCODING",
  OTHER_ENCODING: "OTHER_ENCODING"
};
