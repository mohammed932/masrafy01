import 'package:app/core/network/network_interface.dart';

abstract class BaseRemoteDataSource {
  final BaseNetwork appNetwork;

  BaseRemoteDataSource(this.appNetwork);
}
