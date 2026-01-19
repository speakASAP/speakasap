"""
SpeakASAP Notification Client Package

Provides client interface to notifications-microservice for email sending.
"""

from .notification_client import (
    NotificationClient,
    get_notification_client,
    send_email,
)

__all__ = [
    'NotificationClient',
    'get_notification_client',
    'send_email',
]
