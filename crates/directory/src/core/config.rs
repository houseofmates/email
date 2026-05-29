/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

use registry::structs::{self, Directory};
use super::super::{DirectoryType, backend::oidc::OpenIdDirectory, backend::sql::SqlDirectory};

pub struct DirectoryConfig;

impl DirectoryConfig {
    pub async fn open(directory: &Directory, bp: &super::BuildParams) -> Result<DirectoryType, trc::Error> {
        match directory {
            structs::Directory::Oidc(d) => Ok(DirectoryType::Oidc(OpenIdDirectory::open(d).await?)),
            structs::Directory::Sql(d) => Ok(DirectoryType::Sql(SqlDirectory::open(d, &bp.data_store).await?)),
            _ => Err(trc::DirectoryEvent::Error
                .into_err()
                .details("Directory type not supported")),
        }
    }
}
