use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Alias {
    #[serde(default)]
    pub id: String,
    pub email: String,
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub notes: Option<String>,
}

impl Alias {
    pub fn new(email: String, username: String, password: String, notes: Option<String>) -> Self {
        let mut alias = Self {
            id: String::new(),
            email,
            username,
            password,
            notes,
        };
        alias.ensure_id();
        alias
    }

    pub fn ensure_id(&mut self) {
        if self.id.is_empty() {
            use rand::distributions::Alphanumeric;
            use rand::{thread_rng, Rng};
            self.id = thread_rng()
                .sample_iter(&Alphanumeric)
                .take(12)
                .map(char::from)
                .collect();
        }
    }
}

impl store::Serialize for Alias {
    fn serialize(&self) -> trc::Result<Vec<u8>> {
        serde_json::to_vec(self).map_err(|err| {
            trc::StoreEvent::UnexpectedError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}

impl store::Deserialize for Alias {
    fn deserialize(bytes: &[u8]) -> trc::Result<Self> {
        serde_json::from_slice(bytes).map_err(|err| {
            trc::StoreEvent::DeserializeError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}
