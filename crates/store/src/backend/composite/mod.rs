/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <{{stalwart_contact_email}}>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 *
 * This file is subject to the Stalwart Enterprise License Agreement (SEL) and
 * is NOT open source software.
 *
 */

#[cfg(any(feature = "postgres", feature = "mysql"))]
pub mod read_replica;
pub mod sharded_blob;
pub mod sharded_lookup;
