/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <{{stalwart_contact_email}}>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

#![warn(clippy::large_futures)]

pub mod cache;
pub mod identity;
pub mod mailbox;
pub mod message;
pub mod push;
pub mod sieve;
pub mod submission;
pub mod alias;
