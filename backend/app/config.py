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
