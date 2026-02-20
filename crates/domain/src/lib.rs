use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("{kind} id cannot be empty")]
    EmptyId { kind: &'static str },
    #[error("currency code must be 3 uppercase letters")]
    InvalidCurrency,
    #[error("doctype key cannot be empty")]
    EmptyDocType,
}

macro_rules! id_type {
    ($name:ident, $kind:literal) => {
        #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
        pub struct $name(String);

        impl $name {
            pub fn parse(value: impl Into<String>) -> Result<Self, DomainError> {
                let value = value.into().trim().to_string();
                if value.is_empty() {
                    return Err(DomainError::EmptyId { kind: $kind });
                }
                Ok(Self(value))
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl core::fmt::Display for $name {
            fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
                write!(f, "{}", self.0)
            }
        }
    };
}

id_type!(TenantId, "tenant");
id_type!(CompanyId, "company");
id_type!(UserId, "user");
id_type!(RoleId, "role");

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Currency(String);

impl Currency {
    pub fn parse(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into().trim().to_ascii_uppercase();
        if value.len() != 3 || !value.chars().all(|ch| ch.is_ascii_uppercase()) {
            return Err(DomainError::InvalidCurrency);
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub amount_minor: i64,
    pub currency: Currency,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocType {
    pub key: String,
    pub module: String,
}

impl DocType {
    pub fn parse(key: impl Into<String>, module: impl Into<String>) -> Result<Self, DomainError> {
        let key = key.into().trim().to_string();
        if key.is_empty() {
            return Err(DomainError::EmptyDocType);
        }

        Ok(Self {
            key,
            module: module.into().trim().to_string(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum WorkflowState {
    Draft,
    Submitted,
    Cancelled,
    Custom(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEvent {
    pub tenant_id: TenantId,
    pub company_id: CompanyId,
    pub actor_user_id: UserId,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub created_at_ms: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ids() {
        let tenant = TenantId::parse("tenant_1").expect("tenant id should parse");
        assert_eq!(tenant.as_str(), "tenant_1");
    }

    #[test]
    fn rejects_empty_id() {
        let err = TenantId::parse("   ").expect_err("empty id should fail");
        assert_eq!(err, DomainError::EmptyId { kind: "tenant" });
    }

    #[test]
    fn validates_currency() {
        assert!(Currency::parse("usd").is_ok());
        assert!(Currency::parse("us").is_err());
    }

    #[test]
    fn validates_doctype() {
        assert!(DocType::parse("Sales Invoice", "Selling").is_ok());
        assert!(DocType::parse("", "Selling").is_err());
    }
}
