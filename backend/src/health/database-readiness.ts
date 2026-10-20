/** A bounded, read-only database probe. No scheduling or patient data is returned. */
export abstract class DatabaseReadiness {
  abstract isReady(): Promise<boolean>;
}
