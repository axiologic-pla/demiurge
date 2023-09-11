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
    GOVERNANCE_CREDENTIALS: "governance_credentials",
    GOVERNANCE_MY_VOTES: "governance_my_votes",
    GOVERNANCE_ORGANIZATIONS: "governance_organizations",
    VOTING_SESSIONS: "voting_sessions",
    VOTING_DATA_TABLE: "voting_data",
    VOTES_LIST_TABLE: "votes_list"
  },
  VOTING_DATA_PK: "voting_data_pk",
  CONTENT_TYPE: {
    CREDENTIAL: "credential",
    DATABASE: "db",
    GROUP_MEMBER: "group_member"
  },
  DB_KEY_SSI_PATH: "/dbKeySSI",
  SECURITY_CONTEXT_KEY_SSI_PATH: "security-context",
  IDENTITY_PK: "identity_pk",
  IDENTITY: "identity",
  WALLET_STATUS: "walletStatus",
  RECIPIENT_TYPES: {
    USER_RECIPIENT: "user",
    GROUP_RECIPIENT: "group"
  },
  OPERATIONS: {
    REMOVE: "Remove user",
    ADD: "Add user",
    DEACTIVATE: "Deactivate user",
    LOGIN: "Access wallet ",
    SHARED_ENCLAVE_CREATE: "Create identity ",
    BREAK_GLASS_RECOVERY: "Wallet recovered with The Break Glass Recovery Code"
  },
  SHARED_ENCLAVE: "demiurgeSharedEnclave",
  ADMIN_ACCESS_MODE: "admin",
  WRITE_ACCESS_MODE: "write",
  READ_ONLY_ACCESS_MODE: "read",
  // Backward compatibility for ePI
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
  EPI_ADMIN_GROUP_NAME: "ePI Administration Group",
  EPI_ADMIN_GROUP: "ePI_Administration_Group",
  EPI_READ_GROUP: "ePI_Read_Group",
  EPI_SHARED_ENCLAVE: "epiEnclave",

  JWT_ENCODING: "JWT_ENCODING",
  GS1_ENCODING: "GS1_ENCODING",
  OTHER_ENCODING: "OTHER_ENCODING",

  CREDENTIAL_TYPES: {
    WALLET_AUTHORIZATION: "WALLET_AUTHORIZATION"
  },
  ACCOUNT_STATUS: {
    WAITING_APPROVAL: "waitingForApproval",
    CREATED: "created"
  },
  INITIAL_IDENTITY_PUBLIC_NAME: "initial_demiurge_identity",
  SSI_NAME_DID_TYPE: "ssi:name",
  SSI_GROUP_DID_TYPE: "ssi:group",
  GROUP_MESSAGES_PATH: "/app/messages/createGroup.json",
  ENCLAVE_MESSAGES_PATH: "/app/messages/createEnclave.json",
  /*MANAGED_FEATURES_ARR should be in sync with environment.js */
  MANAGED_FEATURES_ARR: [
    "enable_credentials_management",
    "enable_enclaves_management",
    "enable_deactivate_group_member_feature"
  ],
  MESSAGE_TYPES: {
    USER_LOGIN: "userLogin",
    USER_REMOVED: "userRemoved",
    RECEIVED_APPROVAL: "receivedApproval",
    DID_CREATED: "didCreated",
    ADD_MEMBER_TO_GROUP: "AddMemberToGroup"
  },
  HOOKS: {
    BEFORE_PAGE_LOADS: "beforePageLoads",
    WHEN_PAGE_CLOSE: "whenPageClose",
    BEFORE_APP_LOADS: "beforeAppLoads",
    AFTER_APP_LOADS: "afterAppLoads"
  },
  NOTIFICATION_TYPES: {
    WARN: "warn",
    INFO: "info",
    ERROR: "error"
  },
  HTML_EVENTS: {
    CLOSED: "closed",
    CONFIRMED: "confirmed",
    SEARCH: "search",
    CLICK: "click",
    FOCUSOUT: "focusout",
    CHANGE: "change"
  }
};
