import 'base_remote_data_source.dart';

abstract class BaseRepository<T extends BaseRemoteDataSource> {
  final T remoteDataSource;

  BaseRepository(this.remoteDataSource);
}
