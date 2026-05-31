use serde::{Deserialize, Serialize};

fn gen_id() -> String {
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(12)
        .map(char::from)
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Credential {
    #[serde(default)]
    pub id: String,
    pub site: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub notes: Option<String>,
}

impl Credential {
    pub fn ensure_id(&mut self) {
        if self.id.is_empty() {
            self.id = gen_id();
        }
    }
}

impl store::Serialize for Credential {
    fn serialize(&self) -> trc::Result<Vec<u8>> {
        serde_json::to_vec(self).map_err(|err| {
            trc::StoreEvent::UnexpectedError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}

impl store::Deserialize for Credential {
    fn deserialize(bytes: &[u8]) -> trc::Result<Self> {
        serde_json::from_slice(bytes).map_err(|err| {
            trc::StoreEvent::DeserializeError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}
