use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// In-memory alias store (for demo/prototype). Replace with persistent storage later.
#[derive(Clone, Default)]
pub struct AliasStore {
    inner: Arc<RwLock<HashMap<String, Alias>>>,
}

impl AliasStore {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn list(&self) -> Vec<Alias> {
        self.inner.read().unwrap().values().cloned().collect()
    }

    pub fn get(&self, id: &str) -> Option<Alias> {
        self.inner.read().unwrap().get(id).cloned()
    }

    pub fn insert(&self, alias: Alias) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        inner.insert(alias.id.clone(), alias);
        Ok(())
    }

    pub fn update(&self, id: &str, alias: Alias) -> Result<(), ()> {
        let mut inner = self.inner.write().unwrap();
        if inner.contains_key(id) {
            inner.insert(id.to_string(), alias);
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Alias {
    pub id: String,
    pub email: String,
    pub username: String,
    pub password: String,
    pub notes: Option<String>,
}

impl Alias {
    pub fn new(email: String, username: String, password: String, notes: Option<String>) -> Self {
        use rand::distributions::Alphanumeric;
        use rand::{thread_rng, Rng};
        let id: String = thread_rng()
            .sample_iter(&Alphanumeric)
            .take(12)
            .map(char::from)
            .collect();
        Self {
            id,
            email,
            username,
            password,
            notes,
        }
    }
}

/// HTTP handler state that gets injected into routes
#[derive(Clone)]
pub struct AliasState {
    pub store: AliasStore,
}

impl AliasState {
    pub fn new() -> Self {
        Self {
            store: AliasStore::new(),
        }
    }
}
