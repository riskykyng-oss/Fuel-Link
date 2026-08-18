from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="", extra="ignore", case_sensitive=False
    )

    fuellink_secret_key: str = "dev-only-insecure-key-change-in-production"
    fuellink_database_url: str = "sqlite:///./fuellink.db"
    fuellink_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    access_token_expire_minutes: int = 60 * 24 * 7

    paynow_integration_id: str = ""
    paynow_integration_key: str = ""
    paynow_result_url: str = "http://localhost:8000/api/payments/paynow/callback"
    paynow_return_url: str = "http://localhost:5173/payment/return"

    fuellink_delivery_rate_multiplier: float = 3.0
    fuellink_search_radius_km: float = 20.0
    # Server-clock deadline for a dispatch offer (master spec §6). Decline or
    # timeout cascades the offer to the next-ranked provider.
    fuellink_offer_ttl_seconds: int = 60
    # How often the background sweeper re-resolves expired offers.
    fuellink_offer_sweep_seconds: float = 1.0

    # Phone verification. sms_mode "mock" returns the code in the response so
    # the flow is testable end to end before an SMS provider is wired up.
    fuellink_sms_mode: str = "mock"
    verification_code_ttl_minutes: int = 5
    verification_code_max_attempts: int = 5
    verification_resend_seconds: int = 60
    verification_rate_phone_window_seconds: int = 900
    verification_rate_phone_max: int = 10
    verification_rate_ip_window_seconds: int = 900
    verification_rate_ip_max: int = 20

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.fuellink_cors_origins.split(",") if o.strip()]

    @property
    def paynow_live(self) -> bool:
        return bool(self.paynow_integration_id and self.paynow_integration_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
