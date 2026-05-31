use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// In-memory identity (sender profile) store. Replace with persistent storage later.
#[derive(Clone, Default)]
pub struct IdentityStore {
    inner: Arc<RwLock<HashMap<String, Identity>>>,
}

impl IdentityStore {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn list(&self) -> Vec<Identity> {
        self.inner.read().unwrap().values().cloned().collect()
    }

    pub fn get(&self, id: &str) -> Option<Identity> {
        self.inner.read().unwrap().get(id).cloned()
    }

    pub fn insert(&self, identity: Identity) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        inner.insert(identity.id.clone(), identity);
        Ok(())
    }

    pub fn update(&self, id: &str, identity: Identity) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        if inner.contains_key(id) {
            inner.insert(id.to_string(), identity);
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

/// HTTP handler state that gets injected into routes
#[derive(Clone)]
pub struct IdentityState {
    pub store: IdentityStore,
}

impl IdentityState {
    pub fn new() -> Self {
        Self {
            store: IdentityStore::new(),
        }
    }
}

impl Default for IdentityState {
    fn default() -> Self {
        Self::new()
    }
}
