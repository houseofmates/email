/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <{{stalwart_contact_email}}>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

use backend::oidc::OpenIdDirectory;
use backend::sql::SqlDirectory;

pub mod backend;
pub mod core;

use core::{
    config::DirectoryConfig,
    secret::{hash_secret, verify_mfa_secret_hash},
};
use registry::structs::Directory;
use trc::IntoError;

pub enum DirectoryType {
    Oidc(OpenIdDirectory),
    Sql(SqlDirectory),
}

impl DirectoryType {
    pub async fn open(directory: &Directory, bp: &core::BuildParams) -> Result<Self, trc::Error> {
        match directory {
            Directory::Oidc(d) => Ok(DirectoryType::Oidc(OpenIdDirectory::open(d).await?)),
            Directory::Sql(d) => Ok(DirectoryType::Sql(SqlDirectory::open(d, &bp.data_store).await?)),
            _ => Err(trc::DirectoryEvent::Error
                .into_err()
                .details("Unsupported directory type")),
        }
    }
}

