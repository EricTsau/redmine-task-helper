from ldap3 import Server, Connection, ALL, SIMPLE, Tls
from typing import Optional, Dict
from app.models import LDAPSettings
import ssl

class LDAPService:
    def __init__(self, settings: LDAPSettings):
        self.settings = settings

    def authenticate(self, username: str, password: str) -> bool:
        """
        Attempts to authenticate a user with the provided username and password against the LDAP server.
        """
        if not self.settings.is_active:
            return False
        
        try:
            # Connect to server
            # Note: We detect if it's ldaps or ldap from the URL
            use_ssl = self.settings.server_url.startswith('ldaps://')
            server = Server(self.settings.server_url, get_info=ALL, use_ssl=use_ssl)
            
            # Formulate user DN
            user_dn = self.settings.user_dn_template.format(username=username)
            
            # Try to bind with user credentials
            with Connection(server, user=user_dn, password=password, authentication=SIMPLE) as conn:
                if conn.bind():
                    return True
            return False
        except Exception as e:
            print(f"LDAP Error: {e}")
            return False

    def get_user_info(self, username: str) -> Optional[Dict]:
        """
        Retrieves user information (email, full name) from LDAP.
        """
        if not self.settings.is_active:
            return None

        try:
            use_ssl = self.settings.server_url.startswith('ldaps://')
            server = Server(self.settings.server_url, get_info=ALL, use_ssl=use_ssl)
            
            # Use bind credentials if provided
            user = self.settings.bind_dn if self.settings.bind_dn else None
            password = self.settings.bind_password if self.settings.bind_password else None
            
            with Connection(server, user=user, password=password, authentication=SIMPLE) as conn:
                if not conn.bind():
                    return None
                    
                search_filter = f"(uid={username})"
                conn.search(
                    search_base=self.settings.base_dn,
                    search_filter=search_filter,
                    attributes=['cn', 'mail', 'displayName']
                )
                
                if not conn.entries:
                    return None
                
                entry = conn.entries[0]
                
                # Extract common attributes
                full_name = str(entry.displayName) if hasattr(entry, 'displayName') and entry.displayName else str(entry.cn) if hasattr(entry, 'cn') else username
                email = str(entry.mail) if hasattr(entry, 'mail') else ""
                
                return {
                    "full_name": full_name,
                    "email": email
                }
        except Exception as e:
            print(f"LDAP Info Error: {e}")
            return None
