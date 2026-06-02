/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <{{stalwart_contact_email}}>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

use crate::utils::{jmap::JmapUtils, server::TestServer};
use jmap_proto::{
    object::participant_identity::ParticipantIdentityProperty, request::method::MethodObject,
};
use serde_json::json;
use store::write::BatchBuilder;
use types::{collection::Collection, field::PrincipalField};

pub async fn test(test: &TestServer) {
    println!("Running Participant Identity tests...");
    let account = test.account("jdoe@{{alias_domain}}");

    // Obtain all identities
    let response = account
        .jmap_get(
            MethodObject::ParticipantIdentity,
            [
                ParticipantIdentityProperty::Id,
                ParticipantIdentityProperty::Name,
                ParticipantIdentityProperty::CalendarAddress,
                ParticipantIdentityProperty::IsDefault,
            ],
            Vec::<&str>::new(),
        )
        .await;
    response.list_array().assert_is_equal(json!([
      {
        "id": "a",
        "name": "John Doe",
        "calendarAddress": "mailto:jdoe@{{alias_domain}}",
        "isDefault": true
      },
      {
        "id": "b",
        "name": "John Doe",
        "calendarAddress": "mailto:john.doe@{{alias_domain}}",
        "isDefault": false
      }
    ]));

    // Destroy identity b
    let response = account
        .jmap_destroy(
            MethodObject::ParticipantIdentity,
            ["b"],
            Vec::<(&str, &str)>::new(),
        )
        .await;
    assert_eq!(response.destroyed().next(), Some("b"));
    let response = account
        .jmap_get(
            MethodObject::ParticipantIdentity,
            [
                ParticipantIdentityProperty::Id,
                ParticipantIdentityProperty::Name,
                ParticipantIdentityProperty::CalendarAddress,
                ParticipantIdentityProperty::IsDefault,
            ],
            Vec::<&str>::new(),
        )
        .await;
    response.list_array().assert_is_equal(json!([
      {
        "id": "a",
        "name": "John Doe",
        "calendarAddress": "mailto:jdoe@{{alias_domain}}",
        "isDefault": true
      }
    ]));

    // Creating a new identity with an unauthorized calendar address should fail
    let response = account
        .jmap_create(
            MethodObject::ParticipantIdentity,
            [
                json!({
                    "name": "Work",
                    "calendarAddress": "mailto:work@{{alias_domain}}"
                }),
                json!({
                    "name": "Work",
                    "calendarAddress": "work@{{alias_domain}}"
                }),
            ],
            [("onSuccessSetIsDefault", "#i0")],
        )
        .await;
    assert_eq!(
        response.not_created(0).description(),
        "Calendar address not configured for this account."
    );
    assert_eq!(
        response.not_created(1).description(),
        "Calendar address not configured for this account."
    );

    // Create a new identity and set it as default
    let response = account
        .jmap_create(
            MethodObject::ParticipantIdentity,
            [json!({
                "name": "Johnny B Goode",
                "calendarAddress": "mailto:john.doe@{{alias_domain}}"
            })],
            [("onSuccessSetIsDefault", "#i0")],
        )
        .await;
    response.created(0);
    let response = account
        .jmap_get(
            MethodObject::ParticipantIdentity,
            [
                ParticipantIdentityProperty::Id,
                ParticipantIdentityProperty::Name,
                ParticipantIdentityProperty::CalendarAddress,
                ParticipantIdentityProperty::IsDefault,
            ],
            Vec::<&str>::new(),
        )
        .await;
    response.list_array().assert_is_equal(json!([
      {
        "id": "a",
        "name": "John Doe",
        "calendarAddress": "mailto:jdoe@{{alias_domain}}",
        "isDefault": false
      },
      {
        "id": "b",
        "name": "Johnny B Goode",
        "calendarAddress": "mailto:john.doe@{{alias_domain}}",
        "isDefault": true
      }
    ]));

    // Cleanup
    let mut batch = BatchBuilder::new();
    batch
        .with_account_id(account.id().document_id())
        .with_collection(Collection::Principal)
        .with_document(0)
        .clear(PrincipalField::ParticipantIdentities);
    test.server.commit_batch(batch).await.unwrap();
    test.assert_is_empty().await;
}
