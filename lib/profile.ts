export type FavoriteType = "artist" | "movie" | "tv_show";

export type KnownFavorite = {
  type: FavoriteType;
  name: string;
};

export type Profile = {
  firstName: string;
  birthYear: number;
  hometown: string;
  knownFavorites: KnownFavorite[];
  topicsToAvoid: string[];
  otherTopicsToAvoid: string;
};
