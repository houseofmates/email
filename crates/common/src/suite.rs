//! Persistent storage for the personal-suite record types (aliases, sender
//! identities, saved credentials).
//!
//! These are small, global (not per-account) collections of JSON-serialisable
//! records. Rather than introduce new storage subspaces (which would require
//! touching every backend, and every single-letter subspace is already taken),
//! we store them in the existing `SUBSPACE_PROPERTY` value space using
//! `ValueClass::Any`, which writes our key bytes verbatim.
//!
//! Every real key in the property subspace begins with a 4-byte big-endian
//! `account_id`, and account ids are assigned from 0 upward. By prefixing our
//! keys with a `0xFFFFFFFF` sentinel (account id `u32::MAX`) followed by a
//! record-kind tag, our records sit far above any account that could plausibly
//! exist, so they can never collide with mail/JMAP property keys and are never
//! swept by per-account deletion.

use store::{
    Deserialize, IterateParams, SUBSPACE_PROPERTY, Serialize, Store, ValueKey,
    write::{AnyClass, BatchBuilder, ValueClass},
};

/// Sentinel account-id prefix (u32::MAX) keeping our keys out of any real range.
const SENTINEL: [u8; 4] = [0xFF, 0xFF, 0xFF, 0xFF];

/// Record-kind tags (one byte each), namespacing the three collections.
pub const KIND_ALIAS: u8 = b'A';
pub const KIND_IDENTITY: u8 = b'I';
pub const KIND_CREDENTIAL: u8 = b'C';

fn record_key(kind: u8, id: &str) -> Vec<u8> {
    let mut key = Vec::with_capacity(SENTINEL.len() + 1 + id.len());
    key.extend_from_slice(&SENTINEL);
    key.push(kind);
    key.extend_from_slice(id.as_bytes());
    key
}

fn class(key: Vec<u8>) -> ValueClass {
    ValueClass::Any(AnyClass {
        subspace: SUBSPACE_PROPERTY,
        key,
    })
}

/// Insert or replace a record.
pub async fn put<T: Serialize>(store: &Store, kind: u8, id: &str, value: &T) -> trc::Result<()> {
    let bytes = value.serialize()?;
    let mut batch = BatchBuilder::new();
    batch.set(class(record_key(kind, id)), bytes);
    store.write(batch.build_all()).await.map(|_| ())
}

/// Fetch a single record by id.
pub async fn get<T: Deserialize + 'static>(
    store: &Store,
    kind: u8,
    id: &str,
) -> trc::Result<Option<T>> {
    store
        .get_value::<T>(ValueKey::from(class(record_key(kind, id))))
        .await
}

/// Delete a record by id (no-op if it does not exist).
pub async fn delete(store: &Store, kind: u8, id: &str) -> trc::Result<()> {
    let mut batch = BatchBuilder::new();
    batch.clear(class(record_key(kind, id)));
    store.write(batch.build_all()).await.map(|_| ())
}

/// List every record of a given kind.
pub async fn list<T: Deserialize + 'static>(store: &Store, kind: u8) -> trc::Result<Vec<T>> {
    let mut from = SENTINEL.to_vec();
    from.push(kind);
    let mut to = SENTINEL.to_vec();
    to.push(kind);
    to.extend_from_slice(&[u8::MAX; 16]);

    let mut results = Vec::new();
    store
        .iterate(
            IterateParams::new(ValueKey::from(class(from)), ValueKey::from(class(to))),
            |_key, value| {
                results.push(T::deserialize(value)?);
                Ok(true)
            },
        )
        .await?;
    Ok(results)
}
