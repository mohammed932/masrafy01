import '../network/network_interface.dart';

/// Constitution Principle XXX canonical base. Every feature's
/// `<Name>RemoteDataSource` extends this and reaches the network via
/// `appNetwork.<verb>(MasrafyEndpoint(...))`. Datasources MUST NOT
/// import `package:dio/dio.dart`.
abstract class BaseRemoteDataSource {
  BaseRemoteDataSource(this.appNetwork);

  final BaseNetwork appNetwork;
}
