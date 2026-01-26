"""
Notification Client for SpeakASAP

This client provides a Python interface to the notifications-microservice API.
All email communication from speakasap.com goes through notifications-microservice
using AWS SES provider.

Python 3.4+ compatible (no f-strings, use .format() or % formatting).
"""

import os
import requests
import logging

logger = logging.getLogger(__name__)

# Default notification service URL
NOTIFICATION_SERVICE_URL = os.getenv(
    'NOTIFICATION_SERVICE_URL',
    'https://notifications.statex.cz'
)

# Default timeout in seconds
NOTIFICATION_SERVICE_TIMEOUT = int(os.getenv('NOTIFICATION_SERVICE_TIMEOUT', '10'))


class NotificationClient(object):
    """Client for sending notifications via notifications-microservice"""

    def __init__(self, base_url=None, timeout=None):
        """Initialize notification client

        Args:
            base_url: Base URL for notifications-microservice (optional)
            timeout: Request timeout in seconds (optional)
        """
        self.base_url = base_url or NOTIFICATION_SERVICE_URL
        self.timeout = timeout if timeout is not None else NOTIFICATION_SERVICE_TIMEOUT

    def send_email(
        self,
        to,
        subject,
        message,
        template_data=None,
        attachments=None
    ):
        """Send email via notifications-microservice using AWS SES

        Args:
            to: Recipient email address
            subject: Email subject
            message: Email message body (supports {{template}} variables)
            template_data: Optional template variables for message (dict)
            attachments: Optional list of attachment file paths
            Note: contentType parameter removed - notifications-microservice auto-detects content type

        Returns:
            Dict with success status and notification ID

        Raises:
            requests.RequestException: If notification service is unavailable
        """
        payload = {
            'channel': 'email',
            'type': 'custom',
            'recipient': to,
            'subject': subject,
            'message': message,
            'templateData': template_data or {},
            'emailProvider': 'ses',  # Use AWS SES for SpeakASAP
        }

        if attachments:
            payload['attachments'] = attachments

        # contentType removed - notifications-microservice auto-detects content type from message

        url = '{}/notifications/send'.format(self.base_url)

        try:
            response = requests.post(
                url,
                json=payload,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            result = response.json()
            logger.info('Email sent successfully to {} via notifications-microservice'.format(to))
            return result
        except requests.RequestException as e:
            logger.error('Failed to send email to {}: {}'.format(to, str(e)))
            raise

    def send_notification(
        self,
        channel,
        recipient,
        message,
        subject=None,
        notification_type='custom',
        template_data=None
    ):
        """Generic notification sender

        Args:
            channel: 'email', 'telegram', 'whatsapp'
            recipient: Recipient address/ID
            message: Message content
            subject: Optional subject (for email)
            notification_type: Type of notification (default: 'custom')
            template_data: Optional template variables (dict)

        Returns:
            Dict with success status and notification ID

        Raises:
            requests.RequestException: If notification service is unavailable
        """
        payload = {
            'channel': channel,
            'type': notification_type,
            'recipient': recipient,
            'message': message,
        }

        if subject:
            payload['subject'] = subject

        if template_data:
            payload['templateData'] = template_data

        if channel == 'email':
            payload['emailProvider'] = 'ses'

        url = '{}/notifications/send'.format(self.base_url)

        try:
            response = requests.post(
                url,
                json=payload,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            result = response.json()
            logger.info('Notification sent successfully via notifications-microservice')
            return result
        except requests.RequestException as e:
            logger.error('Failed to send notification: {}'.format(str(e)))
            raise


# Singleton instance
_notification_client = None


def get_notification_client():
    """Get singleton notification client instance

    Returns:
        NotificationClient: Singleton instance of notification client
    """
    global _notification_client
    if _notification_client is None:
        _notification_client = NotificationClient()
    return _notification_client


def send_email(to, subject, message, **kwargs):
    """Convenience function for sending email

    Args:
        to: Recipient email address
        subject: Email subject
        message: Email message body
        **kwargs: Additional arguments (template_data, attachments, etc.)
                  Note: contentType is ignored - microservice auto-detects content type

    Returns:
        Dict with success status and notification ID
    """
    # Filter out contentType if passed - microservice auto-detects content type
    kwargs.pop('contentType', None)
    client = get_notification_client()
    return client.send_email(to=to, subject=subject, message=message, **kwargs)
