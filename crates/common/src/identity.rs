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
pub struct Identity {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub signature: Option<String>,
    #[serde(default)]
    pub reply_to: Option<String>,
}

impl Identity {
    pub fn ensure_id(&mut self) {
        if self.id.is_empty() {
            self.id = gen_id();
        }
    }
}

impl store::Serialize for Identity {
    fn serialize(&self) -> trc::Result<Vec<u8>> {
        serde_json::to_vec(self).map_err(|err| {
            trc::StoreEvent::UnexpectedError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}

impl store::Deserialize for Identity {
    fn deserialize(bytes: &[u8]) -> trc::Result<Self> {
        serde_json::from_slice(bytes).map_err(|err| {
            trc::StoreEvent::DeserializeError
                .caused_by(trc::location!())
                .reason(err)
        })
    }
}
