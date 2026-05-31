use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// In-memory credential (passwords) store. Replace with persistent storage later.
#[derive(Clone, Default)]
pub struct CredentialStore {
    inner: Arc<RwLock<HashMap<String, Credential>>>,
}

impl CredentialStore {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn list(&self) -> Vec<Credential> {
        self.inner.read().unwrap().values().cloned().collect()
    }

    pub fn get(&self, id: &str) -> Option<Credential> {
        self.inner.read().unwrap().get(id).cloned()
    }

    pub fn insert(&self, credential: Credential) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        inner.insert(credential.id.clone(), credential);
        Ok(())
    }

    pub fn update(&self, id: &str, credential: Credential) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        if inner.contains_key(id) {
            inner.insert(id.to_string(), credential);
            Ok(())
        } else {
            Err(())
        }
    }

    pub fn delete(&self, id: &str) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        if inner.remove(id).is_some() {
            Ok(())
        } else {
            Err(())
        }
    }
}

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

/// HTTP handler state that gets injected into routes
#[derive(Clone)]
pub struct CredentialState {
    pub store: CredentialStore,
}

impl CredentialState {
    pub fn new() -> Self {
        Self {
            store: CredentialStore::new(),
        }
    }
}

impl Default for CredentialState {
    fn default() -> Self {
        Self::new()
    }
}
